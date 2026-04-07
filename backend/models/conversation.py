from pydantic import BaseModel
from typing import Optional
import hashlib
import time


class Message(BaseModel):
    id: str
    author: str
    content: str
    timestamp: str
    is_self: bool = False

    @staticmethod
    def generate_id(author: str, content: str, timestamp: str) -> str:
        raw = f"{author}:{content}:{timestamp}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]


class Conversation(BaseModel):
    id: str
    name: str
    last_message: str = ""
    unread: bool = False
    timestamp: str = ""

    @staticmethod
    def generate_id(name: str) -> str:
        return hashlib.md5(name.strip().lower().encode()).hexdigest()[:12]
