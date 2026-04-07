import { useEffect, useRef } from "react";

export default function MessageView({ messages, conversationName }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversationName) {
    return (
      <div className="message-view empty">
        <div className="empty-state">
          <h3>Select a conversation</h3>
          <p>Click a DM from the sidebar to start viewing messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-view">
      <div className="message-header">
        <h3>@{conversationName}</h3>
      </div>
      <div className="message-scroll">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Loading messages...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="message-bubble">
            <div className="msg-header-line">
              <span className="msg-author">{msg.author}</span>
              {msg.timestamp && (
                <span className="msg-time">{msg.timestamp}</span>
              )}
            </div>
            <div className="msg-content">{msg.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
