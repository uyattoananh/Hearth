import os

DISCORD_APPDATA = os.path.join(os.environ.get("APPDATA", ""), "Discord")
DISCORD_LEVELDB = os.path.join(DISCORD_APPDATA, "Local Storage", "leveldb")

# Polling intervals (seconds)
MESSAGE_POLL_INTERVAL = 1.5
CONVERSATION_POLL_INTERVAL = 10.0

# Automation timing (seconds)
NAVIGATE_WAIT = 0.5
SEND_PASTE_WAIT = 0.15
SEND_AFTER_WAIT = 0.3

# Server
HOST = "127.0.0.1"
PORT = 8000
