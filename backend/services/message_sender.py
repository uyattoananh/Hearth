"""
Send messages through Discord via CDP Input API.

Completely invisible — no focus stealing, no clipboard, no window switching.
Uses CDP Input.insertText + Input.dispatchKeyEvent to type and send.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


class MessageSender:
    def __init__(self, discord_window):
        self._dw = discord_window
        self._lock = asyncio.Lock()

    async def send_message(self, content: str) -> dict:
        async with self._lock:
            return await asyncio.to_thread(self._send_sync, content)

    def _send_sync(self, content: str) -> dict:
        if not content.strip():
            return {"success": False, "error": "Empty message"}

        if not self._dw.is_connected:
            return {"success": False, "error": "CDP not connected"}

        try:
            # Step 1: Focus the message input via DOM
            focus_result = self._dw._evaluate('''
            (() => {
                const editor = document.querySelector('[role="textbox"][contenteditable="true"]');
                if (!editor) return 'no editor';
                editor.focus();
                return 'focused';
            })()
            ''')

            if focus_result != "focused":
                return {"success": False, "error": f"Could not focus input: {focus_result}"}

            # Step 2: Insert text via CDP Input API
            self._dw._cdp("Input.insertText", {"text": content})

            # Step 3: Press Enter via CDP Input API
            self._dw._cdp("Input.dispatchKeyEvent", {
                "type": "keyDown",
                "key": "Enter",
                "code": "Enter",
                "windowsVirtualKeyCode": 13,
                "nativeVirtualKeyCode": 13,
            })
            self._dw._cdp("Input.dispatchKeyEvent", {
                "type": "keyUp",
                "key": "Enter",
                "code": "Enter",
                "windowsVirtualKeyCode": 13,
                "nativeVirtualKeyCode": 13,
            })

            logger.info(f"Message sent via CDP: {content[:50]}...")
            return {"success": True, "error": None}

        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return {"success": False, "error": str(e)}
