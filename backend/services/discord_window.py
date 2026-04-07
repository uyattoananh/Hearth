"""
Discord window interaction via Chrome DevTools Protocol (CDP).

Reads DOM, sends messages, replies, edits, reacts, uploads — all invisible.
Cross-platform: works on Windows, macOS, and Linux.
"""
import json
import time
import logging
import re
from typing import Optional

import requests
import websocket

logger = logging.getLogger(__name__)

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"


class DiscordWindow:
    def __init__(self):
        self._ws: Optional[websocket.WebSocket] = None
        self._msg_counter = 0

    def find_window(self) -> bool:
        try:
            targets = requests.get(f"{CDP_URL}/json", timeout=2).json()
            page = next((t for t in targets if t["type"] == "page"), None)
            if not page:
                return False
            self._ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=5)
            self._cdp("Runtime.enable")
            logger.info(f"Connected to Discord CDP: {page['title']}")
            return True
        except Exception as e:
            logger.warning(f"CDP connection failed: {e}")
            self._ws = None
            return False

    @property
    def is_connected(self) -> bool:
        if self._ws is None:
            return False
        try:
            self._ws.ping()
            return True
        except Exception:
            self._ws = None
            return False

    def _cdp(self, method: str, params: dict = None) -> dict:
        self._msg_counter += 1
        msg = {"id": self._msg_counter, "method": method}
        if params:
            msg["params"] = params
        self._ws.send(json.dumps(msg))
        while True:
            resp = json.loads(self._ws.recv())
            if resp.get("id") == self._msg_counter:
                return resp

    def _evaluate(self, expression: str) -> str:
        resp = self._cdp("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        result = resp.get("result", {}).get("result", {})
        if result.get("type") == "string":
            return result["value"]
        return result.get("value", "")

    def get_window_title(self) -> str:
        try:
            return self._evaluate("document.title")
        except Exception:
            return ""

    def get_active_conversation_name(self) -> Optional[str]:
        title = self.get_window_title()
        if not title:
            return None
        name = title.replace(" - Discord", "").strip().lstrip("@").strip()
        if name and name not in ("Friends", "Discord"):
            return name
        return None

    def get_typing_status(self) -> str:
        """Check if someone is typing. Returns username or empty string."""
        try:
            return self._evaluate('''
            (() => {
                const el = document.querySelector('[class*="typing_"][class*="base_"]');
                if (!el || el.offsetHeight === 0) return '';
                // Extract just the username from "X is typing..."
                const text = el.textContent.trim();
                const match = text.match(/^(.+?)\\s+is typing/);
                return match ? match[1] : '';
            })()
            ''') or ""
        except Exception:
            return ""

    def get_current_username(self) -> str:
        try:
            return self._evaluate('''
            (() => {
                const el = document.querySelector('[class*="panelTitle"], [class*="nameTag"]');
                return el ? el.textContent.trim().split(' ')[0] : '';
            })()
            ''') or ""
        except Exception:
            return ""

    def get_active_channel_id(self) -> Optional[str]:
        """Get channel ID from URL. Works for both DMs and server channels."""
        try:
            url = self._evaluate("window.location.href")
            # /channels/@me/CHANNELID or /channels/SERVERID/CHANNELID
            import re as _re
            m = _re.search(r"/channels/[^/]+/(\d+)", url)
            return m.group(1) if m else None
        except Exception:
            return None

    def get_active_server_id(self) -> Optional[str]:
        """Get server ID from URL. Returns None for DMs."""
        try:
            url = self._evaluate("window.location.href")
            if "/@me/" in url:
                return None
            import re as _re
            m = _re.search(r"/channels/(\d+)/", url)
            return m.group(1) if m else None
        except Exception:
            return None

    def is_dm(self) -> bool:
        """Check if currently viewing DMs."""
        try:
            url = self._evaluate("window.location.href")
            return "/@me" in url
        except Exception:
            return True

    # ── Server + Channel Reading ───────────────────────────────────────

    async def read_servers(self) -> list[dict]:
        """Read the server list from Discord's sidebar."""
        if not self.is_connected:
            return []
        try:
            raw = self._evaluate('''
            (() => {
                const items = document.querySelectorAll('[data-list-item-id^="guildsnav___"]');
                return JSON.stringify(Array.from(items).map(el => {
                    const rawId = (el.getAttribute("data-list-item-id") || "").replace("guildsnav___", "");
                    // aria-label may be on el or on a child
                    let label = el.getAttribute("aria-label") || "";
                    if (!label) {
                        // Check children for aria-label
                        const child = el.querySelector("[aria-label]");
                        if (child) label = child.getAttribute("aria-label") || "";
                    }
                    if (!label) {
                        // Fallback: text content
                        label = el.textContent.trim();
                    }
                    const name = label.replace(/^Unread messages, /, "").trim();
                    const img = el.querySelector("img");
                    const unread = label.startsWith("Unread");
                    return { name: name || rawId, id: rawId, iconUrl: img ? img.src : "", unread };
                }).filter(s => s.id && s.id !== "create-join-button" && s.id !== "guild-discover-button"));
            })()
            ''')
            return json.loads(raw) if raw else []
        except Exception as e:
            logger.error(f"Error reading servers: {e}")
            return []

    async def read_channels(self) -> list[dict]:
        """Read channel list for the currently viewed server."""
        if not self.is_connected:
            return []
        try:
            raw = self._evaluate('''
            (() => {
                const links = document.querySelectorAll('a[data-list-item-id^="channels___"]');
                return JSON.stringify(Array.from(links).map(a => {
                    const aria = a.getAttribute("aria-label") || "";
                    const id = (a.getAttribute("data-list-item-id") || "").replace("channels___", "");
                    const href = a.getAttribute("href") || "";
                    const match = href.match(/channels\\/(\\d+)\\/(\\d+)/);
                    // Parse type from aria: "name (text channel)", "name (voice channel)"
                    const typeMatch = aria.match(/\\((text|voice|announcement|forum|stage) channel/);
                    const type = typeMatch ? typeMatch[1] : "text";
                    // Clean name: remove "(text channel)" suffix
                    const name = aria.replace(/\\s*\\(.*$/, "").trim();
                    const locked = aria.includes("locked");
                    return {
                        name, channelId: id,
                        serverId: match ? match[1] : "",
                        type, locked, href
                    };
                }).filter(c => c.name && c.channelId));
            })()
            ''')
            return json.loads(raw) if raw else []
        except Exception as e:
            logger.error(f"Error reading channels: {e}")
            return []

    # ── Sidebar (DMs) ──────────────────────────────────────────────────

    async def read_sidebar(self) -> list[dict]:
        if not self.is_connected:
            return []
        try:
            raw = self._evaluate('''
            (() => {
                const links = document.querySelectorAll('a[href*="/channels/@me/"]');
                return JSON.stringify(Array.from(links).map(a => {
                    const aria = a.getAttribute('aria-label') || '';
                    const href = a.getAttribute('href') || '';
                    const channelId = href.split('/').pop();
                    const nameMatch = aria.match(/^(.+?)\\s*\\(direct message\\)/);
                    const name = nameMatch ? nameMatch[1] : a.textContent.trim().split('\\n')[0];
                    const status = aria.includes('Online') ? 'online'
                                 : aria.includes('Idle') ? 'idle'
                                 : aria.includes('Do Not Disturb') ? 'dnd' : 'offline';
                    const cls = (a.className || '') + ' ' + (a.parentElement?.className || '');
                    const unread = /unread|mentioned/i.test(cls);
                    const img = a.querySelector('img');
                    const iconUrl = img && img.src && img.src.includes('avatars/') ? img.src : '';
                    return { name, channelId, status, unread, iconUrl };
                }).filter(x => x.name && x.channelId));
            })()
            ''')
            return json.loads(raw) if raw else []
        except Exception as e:
            logger.error(f"Error reading sidebar: {e}")
            return []

    # ── Messages (with messageId, reactions, isEdited) ─────────────────

    async def read_messages(self) -> list[dict]:
        if not self.is_connected:
            return []
        try:
            raw = self._evaluate('''
            (() => {
                const msgEls = document.querySelectorAll('[id^="chat-messages-"]');
                const messages = [];
                let lastAuthor = '';

                let lastAvatar = '';
                msgEls.forEach(el => {
                    // Find the message author, excluding any username inside the reply preview
                    const replySection = el.querySelector('[class*="repliedMessage"]');
                    let authorEl = null;
                    const allUsernames = el.querySelectorAll('[id^="message-username-"], [class*="username"]');
                    for (const u of allUsernames) {
                        if (replySection && replySection.contains(u)) continue;
                        authorEl = u;
                        break;
                    }
                    const timeEl = el.querySelector('time');
                    const contentEls = el.querySelectorAll('[id^="message-content-"]');

                    // Find author avatar (skip avatars inside reply preview)
                    const avatarImgs = el.querySelectorAll('img[class*="avatar"]');
                    for (const img of avatarImgs) {
                        if (replySection && replySection.contains(img)) continue;
                        if (img.src && img.src.includes('avatars/')) {
                            lastAvatar = img.src;
                            break;
                        }
                    }

                    if (authorEl) lastAuthor = authorEl.textContent.trim();
                    const timestamp = timeEl ? (timeEl.getAttribute('aria-label') || timeEl.textContent.trim()) : '';

                    // Message ID from element ID: chat-messages-CHANNEL-MSGID
                    const parts = el.id.split('-');
                    const messageId = parts.length >= 4 ? parts[parts.length - 1] : '';

                    // Reply
                    let replyTo = null;
                    const replyEl = el.querySelector('[class*="repliedMessage"]');
                    if (replyEl) {
                        const rAuthor = replyEl.querySelector('[class*="username"]')?.textContent?.trim() || '';
                        let rContent = replyEl.querySelector('[class*="repliedTextPreview"], [class*="repliedText"]')?.textContent?.trim() || '';
                        if (rContent === 'Click to see attachment') rContent = '[image]';
                        if (rAuthor || rContent) replyTo = { author: rAuthor, content: rContent };
                    }

                    // Reactions
                    const reactions = [];
                    el.querySelectorAll('[class*="reaction_"]').forEach(r => {
                        const emoji = r.querySelector('img')?.alt || r.querySelector('[class*="emoji"]')?.textContent?.trim() || '';
                        const countEl = r.querySelector('[class*="reactionCount"]');
                        const count = countEl ? parseInt(countEl.textContent) || 1 : 1;
                        const reacted = r.classList.toString().includes('reactionMe') || r.getAttribute('aria-pressed') === 'true';
                        if (emoji) reactions.push({ emoji, count, reacted });
                    });

                    // Edited
                    const isEdited = el.textContent.includes('(edited)');

                    // Media — deduplicate by filename (same file has different CDN domains)
                    const media = [];
                    const seenFiles = new Set();
                    const getFileName = (url) => {
                        try { return url.split('/').pop().split('?')[0]; } catch(e) { return url; }
                    };
                    el.querySelectorAll('img[class*="lazyImg"], [class*="imageWrapper"] img, [class*="embedImage"] img').forEach(img => {
                        const fname = getFileName(img?.src || '');
                        if (img?.src && !img.src.startsWith('data:') && !img.src.includes('/avatars/') && !img.src.includes('/clan-badges/') && !img.src.includes('/icons/') && !seenFiles.has(fname)) {
                            seenFiles.add(fname);
                            media.push({ type: 'image', url: img.src });
                        }
                    });
                    el.querySelectorAll('a[href*="cdn.discordapp.com/attachments"], a[href*="media.discordapp.net/attachments"]').forEach(a => {
                        const fname = getFileName(a.href);
                        if (!seenFiles.has(fname)) {
                            seenFiles.add(fname);
                            media.push({ type: /\\.(mp4|webm|mov)/i.test(a.href) ? 'video' : 'image', url: a.href });
                        }
                    });
                    el.querySelectorAll('[class*="videoWrapper"] video, video source').forEach(v => {
                        if (v.src && !seen.has(v.src)) { seen.add(v.src); media.push({ type: 'video', url: v.src }); }
                    });
                    el.querySelectorAll('[class*="stickerAsset"] img').forEach(s => {
                        if (s.src && !seen.has(s.src)) { seen.add(s.src); media.push({ type: 'sticker', url: s.src }); }
                    });

                    let pushed = false;
                    contentEls.forEach((ce, idx) => {
                        const content = ce.textContent.trim().replace(/\\(edited\\)$/, '').trim();
                        if (content || (idx === 0 && media.length > 0)) {
                            messages.push({
                                messageId,
                                author: lastAuthor || '?',
                                avatar: lastAvatar || '',
                                content,
                                timestamp: timestamp.replace(/^— /, ''),
                                replyTo,
                                media: idx === 0 ? media : [],
                                reactions: idx === 0 ? reactions : [],
                                isEdited
                            });
                            replyTo = null;
                            pushed = true;
                        }
                    });
                    if (!pushed && media.length > 0) {
                        messages.push({
                            messageId,
                            author: lastAuthor || '?',
                            avatar: lastAvatar || '',
                            content: '',
                            timestamp: timestamp.replace(/^— /, ''),
                            replyTo, media, reactions, isEdited
                        });
                    }
                });
                return JSON.stringify(messages);
            })()
            ''')
            return json.loads(raw) if raw else []
        except Exception as e:
            logger.error(f"Error reading messages: {e}")
            return []

    # ── Navigation ─────────────────────────────────────────────────────

    def click_sidebar_item(self, channel_id: str = None, server_id: str = None, y_position: float = None):
        """Navigate to a channel. Works for both DMs and server channels."""
        if not self.is_connected or not channel_id:
            return False
        try:
            # Try server channel first, then DM
            result = self._evaluate(f'''
            (() => {{
                // Try exact data-list-item-id match (works for both)
                let link = document.querySelector('a[data-list-item-id="channels___{channel_id}"]');
                if (link) {{ link.click(); return 'ok'; }}
                // Fallback: href match for DMs
                link = document.querySelector('a[href="/channels/@me/{channel_id}"]');
                if (link) {{ link.click(); return 'ok'; }}
                // Fallback: href match for server channels
                const allLinks = document.querySelectorAll('a[href*="/{channel_id}"]');
                for (const l of allLinks) {{
                    if (l.href.includes('/channels/')) {{ l.click(); return 'ok'; }}
                }}
                return 'not found';
            }})()
            ''')
            time.sleep(0.5)
            return result == "ok"
        except Exception as e:
            logger.error(f"Error navigating: {e}")
            return False

    def click_server(self, server_id: str) -> bool:
        """Click a server icon in Discord's server list."""
        if not self.is_connected or not server_id:
            return False
        try:
            if server_id == "home":
                # Click the DM/home button
                result = self._evaluate('''
                (() => {
                    const el = document.querySelector('[data-list-item-id="guildsnav___home"]');
                    if (el) { el.click(); return 'ok'; }
                    return 'not found';
                })()
                ''')
            else:
                result = self._evaluate(f'''
                (() => {{
                    const el = document.querySelector('[data-list-item-id="guildsnav___{server_id}"]');
                    if (el) {{ el.click(); return 'ok'; }}
                    return 'not found';
                }})()
                ''')
            time.sleep(0.8)
            return result == "ok"
        except Exception as e:
            logger.error(f"Error clicking server: {e}")
            return False

    # ── Message Actions (Reply, Edit, React) ───────────────────────────

    def _hover_message(self, message_id: str) -> bool:
        """Hover over a message to reveal action buttons. Returns True if button toolbar appeared."""
        try:
            pos = self._evaluate(f'''
            (() => {{
                const el = document.querySelector('[id$="-{message_id}"]');
                if (!el) return '';
                const r = el.getBoundingClientRect();
                return JSON.stringify({{x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)}});
            }})()
            ''')
            if not pos:
                return False
            p = json.loads(pos)
            self._cdp("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": p["x"], "y": p["y"]})
            time.sleep(0.4)
            return True
        except Exception:
            return False

    def _click_action_button(self, message_id: str, label: str) -> bool:
        """Click an action button (Reply, Edit, Add Reaction, etc.) on a hovered message."""
        try:
            pos = self._evaluate(f'''
            (() => {{
                const el = document.querySelector('[id$="-{message_id}"]');
                if (!el) return '';
                const btn = el.querySelector('[aria-label="{label}"]');
                if (!btn) return '';
                const r = btn.getBoundingClientRect();
                return JSON.stringify({{x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)}});
            }})()
            ''')
            if not pos:
                return False
            p = json.loads(pos)
            self._cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": p["x"], "y": p["y"], "button": "left", "clickCount": 1})
            self._cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": p["x"], "y": p["y"], "button": "left", "clickCount": 1})
            time.sleep(0.3)
            return True
        except Exception:
            return False

    def reply_to_message(self, message_id: str) -> bool:
        """Click Reply on a message. Discord shows reply bar above input."""
        if not self._hover_message(message_id):
            return False
        return self._click_action_button(message_id, "Reply")

    def edit_message(self, message_id: str) -> bool:
        """Click Edit on own message. Discord enters edit mode."""
        if not self._hover_message(message_id):
            return False
        return self._click_action_button(message_id, "Edit")

    def add_reaction_open(self, message_id: str) -> bool:
        """Click Add Reaction on a message. Opens emoji picker."""
        if not self._hover_message(message_id):
            return False
        return self._click_action_button(message_id, "Add Reaction")

    def pick_emoji(self, emoji_name: str) -> bool:
        """Type emoji name in the reaction picker search and click first result."""
        try:
            # Find and focus the emoji picker search
            time.sleep(0.3)
            result = self._evaluate('''
            (() => {
                const input = document.querySelector('[class*="emojiPicker"] input, [aria-label="Search Emoji"]');
                if (input) { input.focus(); return 'ok'; }
                return 'no picker';
            })()
            ''')
            if result != "ok":
                return False

            # Type the emoji name
            self._cdp("Input.insertText", {"text": emoji_name})
            time.sleep(0.5)

            # Click first result
            result2 = self._evaluate('''
            (() => {
                const item = document.querySelector('[class*="emojiPicker"] [class*="emojiItem"], [class*="emojiPicker"] [role="gridcell"] img, [class*="emojiPicker"] [role="gridcell"] button');
                if (!item) return '';
                const r = item.getBoundingClientRect();
                return JSON.stringify({x: Math.floor(r.x + r.width/2), y: Math.floor(r.y + r.height/2)});
            })()
            ''')
            if not result2:
                return False

            p = json.loads(result2)
            self._cdp("Input.dispatchMouseEvent", {"type": "mousePressed", "x": p["x"], "y": p["y"], "button": "left", "clickCount": 1})
            self._cdp("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": p["x"], "y": p["y"], "button": "left", "clickCount": 1})
            time.sleep(0.3)
            return True
        except Exception as e:
            logger.error(f"Error picking emoji: {e}")
            return False

    def cancel_reply(self) -> bool:
        """Press Escape to cancel reply/edit mode."""
        try:
            self._cdp("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27})
            self._cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27})
            return True
        except Exception:
            return False

    def upload_file(self, file_path: str) -> bool:
        """Upload a file via Discord's file input element."""
        try:
            # Get the file input node
            resp = self._cdp("Runtime.evaluate", {
                "expression": 'document.querySelector("input[type=file]")',
                "returnByValue": False,
            })
            obj_id = resp.get("result", {}).get("result", {}).get("objectId")
            if not obj_id:
                return False

            # Get the DOM node ID
            node_resp = self._cdp("DOM.describeNode", {"objectId": obj_id})
            node_id = node_resp.get("result", {}).get("node", {}).get("backendNodeId")
            if not node_id:
                return False

            # Set the file
            self._cdp("DOM.setFileInputFiles", {
                "files": [file_path],
                "backendNodeId": node_id,
            })
            time.sleep(0.5)

            # Press Enter to send the file
            self._evaluate('''
                document.querySelector('[role="textbox"][contenteditable="true"]')?.focus()
            ''')
            time.sleep(0.2)
            self._cdp("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13})
            self._cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "nativeVirtualKeyCode": 13})
            time.sleep(0.5)
            return True
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            return False

    def focus_window(self):
        pass

    def click_message_input(self):
        return True
