import { useState, useRef, useEffect } from "react";
import { EmojiAutocomplete, EmojiGrid } from "./EmojiPicker";

export default function InputArea({
  onSend,
  onReply,
  onCancelReply,
  onUploadFile,
  disabled,
  placeholder,
  replyingTo,
  editingMsg,
  onCancelEdit,
  onEditSubmit,
}) {
  const [text, setText] = useState("");
  const [emojiQuery, setEmojiQuery] = useState("");
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (editingMsg) {
      setText(editingMsg.content || "");
      ref.current?.focus();
    }
  }, [editingMsg]);

  useEffect(() => {
    ref.current?.focus();
  }, [disabled]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);

    // Trigger emoji autocomplete after : + 1 char
    const match = val.match(/:(\w+)$/);
    if (match) {
      setEmojiQuery(match[1]);
    } else {
      setEmojiQuery("");
    }
  };

  const insertEmoji = (emoji) => {
    const newText = text.replace(/:(\w*)$/, emoji.char);
    setText(newText);
    setEmojiQuery("");
    setShowEmojiGrid(false);
    ref.current?.focus();
  };

  const doSend = () => {
    if (!text.trim()) return;
    if (editingMsg) {
      onEditSubmit?.(editingMsg.messageId, text);
      setText("");
    } else if (replyingTo) {
      onReply?.(replyingTo.messageId, text);
      setText("");
    } else {
      onSend(text);
      setText("");
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
    if (e.key === "Escape") {
      if (editingMsg) onCancelEdit?.();
      if (replyingTo) onCancelReply?.();
    }
  };

  const handleFilePick = async () => {
    // Use Electron dialog for real file paths
    if (window.electronAPI?.pickFile) {
      const paths = await window.electronAPI.pickFile();
      if (paths && paths.length > 0) {
        for (const p of paths) {
          onUploadFile?.(p);
        }
      }
    }
  };

  return (
    <div className="input-wrapper">
      {(replyingTo || editingMsg) && (
        <div className="input-bar">
          <span className="input-bar-text">
            {editingMsg ? "Editing message" : `Replying to ${replyingTo.author}`}
          </span>
          <button
            className="input-bar-close"
            onClick={() => {
              if (editingMsg) onCancelEdit?.();
              else onCancelReply?.();
              setText("");
            }}
          >
            &times;
          </button>
        </div>
      )}

      <EmojiAutocomplete
        query={emojiQuery}
        onPick={insertEmoji}
        visible={emojiQuery.length >= 1}
      />

      {showEmojiGrid && (
        <EmojiGrid
          onPick={(e) => {
            setText(text + e.char);
            setShowEmojiGrid(false);
            ref.current?.focus();
          }}
        />
      )}

      <div className="input-area">
        <button className="input-icon-btn" onClick={handleFilePick} title="Attach file">
          &#x1F4CE;
        </button>
        <textarea
          ref={ref}
          className="input-box"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
        />
        <button
          className="input-icon-btn"
          onClick={() => setShowEmojiGrid(!showEmojiGrid)}
          title="Emoji"
        >
          &#x1F600;
        </button>
        <button className="send-btn" onClick={doSend} disabled={!text.trim()}>
          &#x27A4;
        </button>
      </div>
    </div>
  );
}
