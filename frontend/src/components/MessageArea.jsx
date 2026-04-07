import { useEffect, useRef, useState } from "react";
import { EmojiGrid } from "./EmojiPicker";

export default function MessageArea({ messages, typing, onReply, onEdit, onReact }) {
  const scrollRef = useRef(null);
  const prevCountRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const [menu, setMenu] = useState(null);
  const [reactPicker, setReactPicker] = useState(null); // {messageId, x, y}

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (messages.length > prevCountRef.current && isNearBottomRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const close = (e) => {
      // Don't close if clicking inside a picker
      if (e.target.closest(".emoji-grid-popup") || e.target.closest(".context-menu")) return;
      setMenu(null);
      setReactPicker(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setReactPicker(null);
    const bubble = e.target.closest(".msg-bubble") || e.target.closest(".msg");
    if (bubble) {
      const rect = bubble.getBoundingClientRect();
      const scrollRect = scrollRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      setMenu({
        bubbleLeft: rect.left,
        bubbleRight: rect.right,
        bubbleTop: rect.top,
        msg,
      });
    } else {
      setMenu({ bubbleLeft: 10, bubbleRight: 200, bubbleTop: e.clientY, msg });
    }
  };

  const QUICK_REACTS = [
    { emoji: "thumbsup", char: "\u{1F44D}" },
    { emoji: "heart", char: "\u{2764}\u{FE0F}" },
    { emoji: "joy", char: "\u{1F602}" },
    { emoji: "fire", char: "\u{1F525}" },
    { emoji: "skull", char: "\u{1F480}" },
  ];

  return (
    <div className="message-area" ref={scrollRef} onScroll={handleScroll}>
      {messages.map((msg, i) => {
        const prevMsg = messages[i - 1];
        const showAvatar = !prevMsg || prevMsg.author !== msg.author;
        return (
        <div
          key={i}
          className={`msg ${msg.isSelf ? "msg-self" : "msg-other"} ${showAvatar ? "with-avatar" : "no-avatar"}`}
          onContextMenu={(e) => handleContextMenu(e, msg)}
        >
          {showAvatar && msg.avatar && (
            <img className="msg-avatar" src={msg.avatar} alt="" referrerPolicy="no-referrer" />
          )}
          {showAvatar && !msg.avatar && (
            <div className="msg-avatar msg-avatar-fallback">{(msg.author || "?").charAt(0).toUpperCase()}</div>
          )}
          <div className="msg-bubble">
            {msg.replyTo && (
              <div className="msg-reply-inline">
                <span className="msg-reply-author">{msg.replyTo.author}</span>
                <span className="msg-reply-content">{msg.replyTo.content}</span>
              </div>
            )}
            {!msg.isSelf && (
              <div className="msg-author-line">
                <span className="msg-author">{msg.author}</span>
                {msg.timestamp && <span className="msg-time">{msg.timestamp}</span>}
                {msg.isEdited && <span className="msg-edited">(edited)</span>}
              </div>
            )}
            {msg.isSelf && (
              <div className="msg-author-line">
                {msg.timestamp && <span className="msg-time">{msg.timestamp}</span>}
                {msg.isEdited && <span className="msg-edited">(edited)</span>}
              </div>
            )}
            {msg.content && <div className="msg-content">{msg.content}</div>}
            {msg.media && msg.media.length > 0 && (
              <div className="msg-media">
                {msg.media.map((m, j) => {
                  if (m.type === "video") {
                    return <video key={j} className="msg-video" src={m.url} controls muted />;
                  }
                  return (
                    <img
                      key={j}
                      className="msg-img"
                      src={m.url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onClick={() => window.open(m.url, "_blank")}
                    />
                  );
                })}
              </div>
            )}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="msg-reactions">
                {msg.reactions.map((r, j) => (
                  <span key={j} className={`reaction-badge ${r.reacted ? "reacted" : ""}`}>
                    {r.emoji} {r.count > 1 && r.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })}

      {typing && (
        <div className="typing-indicator">
          <span className="typing-text">{typing} is typing</span>
          <span className="typing-dots"><span></span><span></span><span></span></span>
        </div>
      )}

      {/* Context Menu */}
      {menu && (
        <div
          className="context-menu"
          style={{
            ...(menu.msg.isSelf
              ? { right: window.innerWidth - menu.bubbleRight }
              : { left: menu.bubbleLeft }),
            top: Math.max(4, menu.bubbleTop - 80),
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="context-react-row">
            {QUICK_REACTS.map((r) => (
              <span
                key={r.emoji}
                className="context-react-btn"
                onClick={() => { onReact?.(menu.msg.messageId, r.emoji); setMenu(null); }}
              >
                {r.char}
              </span>
            ))}
            <span
              className="context-react-btn context-react-plus"
              onClick={(e) => {
                e.stopPropagation();
                setReactPicker({ messageId: menu.msg.messageId, x: menu.x, y: menu.y });
                setMenu(null);
              }}
            >
              +
            </span>
          </div>
          <div
            className="context-item"
            onClick={() => { onReply?.(menu.msg); setMenu(null); }}
          >
            Reply
          </div>
          {menu.msg.isSelf && (
            <div
              className="context-item"
              onClick={() => { onEdit?.(menu.msg); setMenu(null); }}
            >
              Edit
            </div>
          )}
        </div>
      )}

      {/* Full emoji picker for reactions */}
      {reactPicker && (
        <div
          className="react-picker-overlay"
          style={{
            right: 10,
            bottom: 60,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <EmojiGrid
            onPick={(e) => {
              onReact?.(reactPicker.messageId, e.name);
              setReactPicker(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
