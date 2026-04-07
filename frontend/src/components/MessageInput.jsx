import { useState, useRef } from "react";

export default function MessageInput({ onSend, disabled, placeholder }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !disabled) {
        onSend(text);
        setText("");
      }
    }
  };

  const handleSendClick = () => {
    if (text.trim() && !disabled) {
      onSend(text);
      setText("");
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="message-input-container">
      <textarea
        ref={textareaRef}
        className="message-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        className="send-btn"
        onClick={handleSendClick}
        disabled={disabled || !text.trim()}
      >
        Send
      </button>
    </div>
  );
}
