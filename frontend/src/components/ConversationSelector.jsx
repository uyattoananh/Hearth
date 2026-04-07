import { useState, useRef, useEffect } from "react";

const STATUS_COLORS = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
};

export default function ConversationSelector({
  conversations,
  activeId,
  activeName,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="conv-selector" ref={ref}>
      <div className="conv-current" onClick={() => setOpen(!open)}>
        {activeName ? (
          <>
            <div className="conv-current-avatar">
              {activeName.charAt(0).toUpperCase()}
            </div>
            <span className="conv-current-name">@{activeName}</span>
          </>
        ) : (
          <span className="conv-current-name" style={{ color: "#949ba4" }}>
            Select conversation...
          </span>
        )}
        <span className={`conv-current-arrow ${open ? "open" : ""}`}>
          &#x25BC;
        </span>
      </div>

      {open && (
        <div className="conv-dropdown">
          <input
            className="conv-dropdown-search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {filtered.map((conv) => (
            <div
              key={conv.id}
              className={`conv-dropdown-item ${conv.id === activeId ? "active" : ""}`}
              onClick={() => {
                onSelect(conv);
                setOpen(false);
                setSearch("");
              }}
            >
              <div className="conv-dropdown-avatar">
                {conv.name.charAt(0).toUpperCase()}
                <span
                  className="status-dot"
                  style={{
                    background: STATUS_COLORS[conv.status] || STATUS_COLORS.offline,
                  }}
                />
              </div>
              <span className="conv-dropdown-name">{conv.name}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 12, textAlign: "center", color: "#6d6f78", fontSize: 12 }}>
              {conversations.length === 0 ? "Connecting..." : "No matches"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
