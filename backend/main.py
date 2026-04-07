"""
FastAPI server for Discord DM custom UI.

Uses Chrome DevTools Protocol to read Discord's DOM — completely invisible,
no focus stealing, perfect Unicode support.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import HOST, PORT
from services.discord_window import DiscordWindow
from services.conversation_manager import ConversationManager
from services.message_reader import MessageReader
from services.message_sender import MessageSender

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

discord_window = DiscordWindow()
manager = ConversationManager()
reader = MessageReader(discord_window, manager)
sender = MessageSender(discord_window)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Discord DM UI backend (CDP mode)...")
    found = discord_window.find_window()
    if found:
        logger.info(f"Discord CDP connected: {discord_window.get_window_title()}")
    else:
        logger.warning("Discord CDP not found — is Discord running with --remote-debugging-port=9222?")

    reader.enable_auto_poll(True)  # Safe now — no focus stealing with CDP
    await reader.start()
    yield
    await reader.stop()
    logger.info("Backend stopped")


app = FastAPI(title="Discord DM UI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
async def get_status():
    return {
        "discord_connected": discord_window.is_connected,
        "active_conversation": discord_window.get_active_conversation_name(),
        "window_title": discord_window.get_window_title(),
        **manager.get_status(),
    }


@app.get("/api/conversations")
async def get_conversations():
    return {"conversations": manager.get_conversations_list()}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    manager.add_client(ws)
    logger.info("WebSocket client connected")

    try:
        # Send initial state — force refresh to get servers + channels
        await reader.force_refresh()
        await ws.send_json({"type": "status", "data": manager.get_status()})
        await ws.send_json({
            "type": "servers_list",
            "data": {"servers": manager.servers},
        })
        await ws.send_json({
            "type": "conversations_list",
            "data": {"conversations": manager.get_conversations_list()},
        })
        if manager.channels:
            await ws.send_json({
                "type": "channels_list",
                "data": {"channels": manager.channels},
            })

        if manager.active_conversation_id:
            msgs = manager.get_messages(manager.active_conversation_id)
            if msgs:
                await ws.send_json({
                    "type": "messages_update",
                    "data": {
                        "conversation_id": manager.active_conversation_id,
                        "conversation_name": manager.active_conversation_name,
                        "messages": msgs,
                    },
                })

        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            await handle_client_message(ws, msg)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.remove_client(ws)


async def handle_client_message(ws: WebSocket, msg: dict):
    msg_type = msg.get("type", "")
    data = msg.get("data", {})

    if msg_type == "ping":
        await ws.send_json({"type": "pong"})

    elif msg_type == "request_conversations":
        await reader.force_refresh()
        await ws.send_json({
            "type": "conversations_list",
            "data": {"conversations": manager.get_conversations_list()},
        })

    elif msg_type == "navigate":
        conv_id = data.get("conversation_id", "")
        # Try DM conversation first, then server channel
        conv = manager.find_conversation_by_id(conv_id)
        ch = manager.find_channel_by_id(conv_id) if not conv else None
        target = conv or ch
        if target:
            discord_window.click_sidebar_item(channel_id=target.get("channelId", conv_id))
            name = target.get("name", "")
            server_id = target.get("serverId") if ch else None
            manager.set_active(conv_id, name, server_id)
            await asyncio.sleep(1)
            await reader.force_refresh()
        else:
            # Direct click by ID as fallback
            discord_window.click_sidebar_item(channel_id=conv_id)
            await asyncio.sleep(1)
            await reader.force_refresh()

    elif msg_type == "navigate_server":
        server_id = data.get("server_id", "")
        if server_id:
            discord_window.click_server(server_id)
            await asyncio.sleep(1)
            await reader.force_refresh()

    elif msg_type == "send_message":
        content = data.get("content", "").strip()
        conv_id = data.get("conversation_id", "")
        if not content:
            await ws.send_json({
                "type": "send_result",
                "data": {"success": False, "error": "Empty message"},
            })
            return

        # Make sure Discord is showing the right channel
        current_channel = discord_window.get_active_channel_id()
        if conv_id and conv_id != current_channel:
            discord_window.click_sidebar_item(channel_id=conv_id)
            await asyncio.sleep(1)

        # Clipboard paste + Enter (brief focus steal)
        result = await sender.send_message(content)
        await ws.send_json({
            "type": "send_result",
            "data": result,
        })

        await asyncio.sleep(0.5)
        await reader.force_refresh()

    elif msg_type == "reply_to":
        message_id = data.get("messageId", "")
        content = data.get("content", "").strip()
        if not message_id or not content:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Missing messageId or content"}})
            return

        # Click Reply on the target message
        ok = await asyncio.to_thread(discord_window.reply_to_message, message_id)
        if not ok:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Could not click Reply"}})
            return

        # Now send the message (Discord is in reply mode)
        result = await sender.send_message(content)
        await ws.send_json({"type": "send_result", "data": result})
        await asyncio.sleep(0.5)
        await reader.force_refresh()

    elif msg_type == "edit_message":
        message_id = data.get("messageId", "")
        content = data.get("content", "").strip()
        if not message_id or not content:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Missing messageId or content"}})
            return

        # Click Edit on the message
        ok = await asyncio.to_thread(discord_window.edit_message, message_id)
        if not ok:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Could not click Edit"}})
            return

        # Select all existing text and replace
        await asyncio.sleep(0.3)
        discord_window._cdp("Input.dispatchKeyEvent", {"type": "keyDown", "key": "a", "code": "KeyA", "windowsVirtualKeyCode": 65, "modifiers": 2})  # Ctrl+A
        discord_window._cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": "a", "code": "KeyA", "windowsVirtualKeyCode": 65})
        await asyncio.sleep(0.1)
        discord_window._cdp("Input.insertText", {"text": content})
        await asyncio.sleep(0.2)
        discord_window._cdp("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13})
        discord_window._cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13})

        await ws.send_json({"type": "send_result", "data": {"success": True, "error": None}})
        await asyncio.sleep(0.5)
        await reader.force_refresh()

    elif msg_type == "add_reaction":
        message_id = data.get("messageId", "")
        emoji = data.get("emoji", "")
        if not message_id or not emoji:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Missing messageId or emoji"}})
            return

        ok = await asyncio.to_thread(discord_window.add_reaction_open, message_id)
        if ok:
            ok2 = await asyncio.to_thread(discord_window.pick_emoji, emoji)
            await ws.send_json({"type": "send_result", "data": {"success": ok2, "error": None if ok2 else "Could not pick emoji"}})
        else:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "Could not open reaction picker"}})
        await asyncio.sleep(0.5)
        await reader.force_refresh()

    elif msg_type == "cancel_reply":
        await asyncio.to_thread(discord_window.cancel_reply)

    elif msg_type == "upload_file":
        file_path = data.get("filePath", "")
        if not file_path:
            await ws.send_json({"type": "send_result", "data": {"success": False, "error": "No file path"}})
            return
        ok = await asyncio.to_thread(discord_window.upload_file, file_path)
        await ws.send_json({"type": "send_result", "data": {"success": ok, "error": None if ok else "Upload failed"}})
        await asyncio.sleep(1)
        await reader.force_refresh()

    elif msg_type == "request_servers":
        # Debug: check what the DOM has
        try:
            debug = discord_window._evaluate('document.querySelectorAll("[data-list-item-id]").length')
            logger.info(f"DOM list items: {debug}")
            debug2 = discord_window._evaluate('''
                Array.from(document.querySelectorAll("[data-list-item-id]"))
                .filter(e => e.getAttribute("data-list-item-id").startsWith("guildsnav"))
                .map(e => e.getAttribute("data-list-item-id")).join(", ")
            ''')
            logger.info(f"Guild nav IDs: {debug2}")
        except Exception as e:
            logger.error(f"Debug error: {e}")

        servers = await discord_window.read_servers()
        logger.info(f"read_servers returned {len(servers)} servers")
        if servers:
            manager.update_servers(servers)
        await ws.send_json({
            "type": "servers_list",
            "data": {"servers": manager.servers},
        })

    elif msg_type == "refresh_messages":
        await reader.force_refresh()

    elif msg_type == "request_status":
        await ws.send_json({
            "type": "status",
            "data": manager.get_status(),
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
