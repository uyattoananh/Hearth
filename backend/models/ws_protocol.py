from pydantic import BaseModel
from typing import Optional, Any


class WSMessage(BaseModel):
    type: str
    data: Optional[dict] = None


# Client -> Server types
# { type: "request_conversations" }
# { type: "navigate", data: { conversation_id: "..." } }
# { type: "send_message", data: { conversation_id: "...", content: "..." } }
# { type: "ping" }

# Server -> Client types
# { type: "conversations_list", data: { conversations: [...] } }
# { type: "messages_update", data: { conversation_id: "...", messages: [...] } }
# { type: "new_message", data: { conversation_id: "...", message: {...} } }
# { type: "status", data: { discord_connected: bool, active_conversation: str|null, accessibility_ok: bool } }
# { type: "send_result", data: { success: bool, error: str|null } }
# { type: "error", data: { message: "..." } }
# { type: "pong" }
