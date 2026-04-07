"""
Background polling service that reads Discord's state via CDP.
Supports both DMs and server channels.
"""
import asyncio
import logging
from services.discord_window import DiscordWindow
from services.conversation_manager import ConversationManager

logger = logging.getLogger(__name__)

MESSAGE_POLL_INTERVAL = 2.0
SIDEBAR_POLL_INTERVAL = 10.0


class MessageReader:
    def __init__(self, discord_window: DiscordWindow, manager: ConversationManager):
        self._dw = discord_window
        self._manager = manager
        self._running = False
        self._task: asyncio.Task = None
        self._auto_poll_messages = True
        self._my_name = ""

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Message reader started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Message reader stopped")

    def enable_auto_poll(self, enabled: bool = True):
        self._auto_poll_messages = enabled

    async def _poll_loop(self):
        sidebar_timer = 0.0
        while self._running:
            try:
                if not self._dw.is_connected:
                    self._dw.find_window()
                    if not self._dw.is_connected:
                        await asyncio.sleep(5)
                        continue

                # Cache current username
                if not self._my_name:
                    self._my_name = self._dw.get_current_username()

                # Poll sidebar/servers less frequently
                sidebar_timer += MESSAGE_POLL_INTERVAL
                if sidebar_timer >= SIDEBAR_POLL_INTERVAL:
                    sidebar_timer = 0
                    await self._poll_sidebar()

                # Poll messages + typing
                if self._auto_poll_messages:
                    await self._poll_messages()
                    await self._poll_typing()

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Poll error: {e}")
                self._dw._ws = None

            await asyncio.sleep(MESSAGE_POLL_INTERVAL)

    async def _poll_sidebar(self):
        """Poll servers + channels/DMs for the current view."""
        try:
            # Always poll servers
            servers = await self._dw.read_servers()
            if servers:
                self._manager.update_servers(servers)
                await self._manager.broadcast({
                    "type": "servers_list",
                    "data": {"servers": servers},
                })

            # Poll channels or DMs depending on context
            if self._dw.is_dm():
                convos = await self._dw.read_sidebar()
                if convos:
                    self._manager.update_conversations(convos)
                    await self._manager.broadcast({
                        "type": "conversations_list",
                        "data": {"conversations": self._manager.get_conversations_list()},
                    })
            else:
                channels = await self._dw.read_channels()
                if channels:
                    self._manager.update_channels(channels)
                    await self._manager.broadcast({
                        "type": "channels_list",
                        "data": {"channels": channels},
                    })
        except Exception as e:
            logger.error(f"Sidebar poll error: {e}")

    async def _poll_messages(self):
        try:
            active_name = self._dw.get_active_conversation_name()
            if not active_name:
                return

            channel_id = self._dw.get_active_channel_id()
            server_id = self._dw.get_active_server_id()
            if channel_id:
                self._manager.set_active(channel_id, active_name, server_id)

            if not self._manager.active_conversation_id:
                return

            messages = await self._dw.read_messages()
            if not messages:
                return

            # Tag isSelf using current username (works for both DMs and servers)
            my_name = self._my_name.lower()
            for msg in messages:
                author = msg.get("author", "").lower()
                if my_name and author:
                    msg["isSelf"] = author.startswith(my_name)
                else:
                    msg["isSelf"] = False

            self._manager.update_messages(active_name, messages)

            await self._manager.broadcast({
                "type": "messages_update",
                "data": {
                    "conversation_id": self._manager.active_conversation_id,
                    "conversation_name": active_name,
                    "server_id": server_id,
                    "messages": messages,
                },
            })

        except Exception as e:
            logger.error(f"Message poll error: {e}")

    async def _poll_typing(self):
        try:
            typing = self._dw.get_typing_status()
            await self._manager.broadcast({
                "type": "typing",
                "data": {"text": typing},
            })
        except Exception:
            pass

    async def force_refresh(self):
        await self._poll_sidebar()
        await self._poll_messages()
