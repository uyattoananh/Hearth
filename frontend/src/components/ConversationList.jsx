import { useState } from "react";

const STATUS_COLORS = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
};

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onRefresh,
}) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="conversation-list">
      <div className="conv-header">
        <h2>Direct Messages</h2>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh">
          &#x21bb;
        </button>
      </div>
      <input
        className="conv-search"
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="conv-items">
        {filtered.map((conv) => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(conv)}
          >
            <div className="conv-avatar-wrap">
              <div className="conv-avatar">
                {conv.name.charAt(0).toUpperCase()}
              </div>
              <span
                className="status-dot"
                style={{ background: STATUS_COLORS[conv.status] || STATUS_COLORS.offline }}
              />
            </div>
            <div className="conv-info">
              <span className="conv-name">{conv.name}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="conv-empty">
            {conversations.length === 0
              ? "Connecting to Discord..."
              : "No matches"}
          </div>
        )}
      </div>
    </div>
  );
}
