"""
State manager for servers, channels, conversations, and messages.
"""
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class ConversationManager:
    def __init__(self):
        self.servers: list[dict] = []
        self.conversations: dict[str, dict] = {}  # channelId -> DM conversations
        self.channels: list[dict] = []  # Server channels for current server
        self.messages: dict[str, list[dict]] = {}
        self.active_conversation_id: Optional[str] = None
        self.active_conversation_name: Optional[str] = None
        self.active_server_id: Optional[str] = None
        self._clients: set = set()

    def add_client(self, ws):
        self._clients.add(ws)

    def remove_client(self, ws):
        self._clients.discard(ws)

    async def broadcast(self, msg: dict):
        data = json.dumps(msg)
        dead = set()
        for ws in self._clients:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        self._clients -= dead

    def update_servers(self, servers: list[dict]):
        self.servers = servers

    def update_conversations(self, sidebar_items: list[dict]):
        new_convos = {}
        for item in sidebar_items:
            cid = item["channelId"]
            new_convos[cid] = {
                "id": cid,
                "name": item["name"],
                "channelId": cid,
                "status": item.get("status", "offline"),
                "unread": item.get("unread", False),
                "iconUrl": item.get("iconUrl", ""),
            }
        self.conversations = new_convos

    def update_channels(self, channels: list[dict]):
        self.channels = channels

    def update_messages(self, conv_name: str, new_messages: list[dict]) -> list[dict]:
        cid = self.active_conversation_id
        if not cid:
            return []
        old_messages = self.messages.get(cid, [])
        old_sigs = {f"{m['author']}:{m['content'][:50]}" for m in old_messages}
        new_ones = [m for m in new_messages if f"{m['author']}:{m['content'][:50]}" not in old_sigs]
        self.messages[cid] = new_messages
        self.active_conversation_name = conv_name
        return new_ones

    def set_active(self, conv_id: str, name: str, server_id: str = None):
        self.active_conversation_id = conv_id
        self.active_conversation_name = name
        self.active_server_id = server_id

    def get_conversations_list(self) -> list[dict]:
        return [
            {
                "id": c["id"],
                "name": c["name"],
                "status": c["status"],
                "unread": c.get("unread", False),
                "iconUrl": c.get("iconUrl", ""),
            }
            for c in self.conversations.values()
        ]

    def get_messages(self, conv_id: str) -> list[dict]:
        return self.messages.get(conv_id, [])

    def find_conversation_by_id(self, conv_id: str) -> Optional[dict]:
        return self.conversations.get(conv_id)

    def find_channel_by_id(self, channel_id: str) -> Optional[dict]:
        for ch in self.channels:
            if ch["channelId"] == channel_id:
                return ch
        return None

    def get_status(self) -> dict:
        return {
            "discord_connected": True,
            "active_conversation": self.active_conversation_name,
            "active_conversation_id": self.active_conversation_id,
            "active_server_id": self.active_server_id,
            "conversation_count": len(self.conversations),
            "is_dm": self.active_server_id is None,
        }
