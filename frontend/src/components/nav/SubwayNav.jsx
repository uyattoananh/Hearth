import { useState } from "react";

const PALETTE = [
  "#e74c3c", "#3498db", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#2ecc71", "#34495e",
  "#e84393", "#00cec9", "#fdcb6e", "#6c5ce7",
];

function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/**
 * Subway Map: each server is a horizontal colored line.
 * Stations (channels/DMs) go along the line. Click a station to navigate.
 * Unread channels glow. Active station has a pulsing white border.
 */
export default function SubwayNav({
  servers,
  conversations,
  channels,
  activeServerId,
  activeChannelId,
  onSelectServer,
  onSelectChannel,
}) {
  const [expandedId, setExpandedId] = useState(activeServerId || "home");

  const renderLine = (server) => {
    const color = server.id === "home" ? "#5865f2" : colorFor(server.id);
    const isExpanded = expandedId === server.id;
    const isActive = activeServerId === server.id;
    const items = server.id === "home"
      ? conversations
      : (server.id === activeServerId ? channels : []);

    return (
      <div
        key={server.id}
        className={`subway-row ${isExpanded ? "expanded" : ""} ${isActive ? "active" : ""}`}
        style={{ "--line-color": color }}
      >
        {/* Server icon (terminus) */}
        <div
          className="subway-terminus"
          style={{ background: color, borderColor: color }}
          onClick={() => {
            // Toggle: if already expanded, collapse. Otherwise navigate + expand.
            if (isExpanded) {
              setExpandedId(null);
            } else {
              onSelectServer(server.id);
              setExpandedId(server.id);
            }
          }}
          title={server.name}
        >
          {server.iconUrl ? (
            <img src={server.iconUrl} alt="" />
          ) : (
            <span>{server.id === "home" ? "@" : server.name.charAt(0).toUpperCase()}</span>
          )}
          {server.unread && <span className="subway-unread-dot" />}
        </div>

        {/* Server name */}
        <div className="subway-row-info">
          <div className="subway-row-name" onClick={() => setExpandedId(isExpanded ? null : server.id)}>
            {server.name.length > 22 ? server.name.slice(0, 20) + "…" : server.name}
            {server.unread && <span className="subway-row-badge">●</span>}
          </div>

          {/* Track + stations (only when expanded) */}
          {isExpanded && (
            <div className="subway-track-container">
              <div className="subway-track" style={{ background: color }} />
              <div className="subway-stations-list">
                {items.length === 0 && (
                  <div className="subway-empty">
                    {server.id === activeServerId ? "no channels" : "click to load"}
                  </div>
                )}
                {items.map((item) => {
                  const id = item.id || item.channelId;
                  const isStationActive = id === activeChannelId;
                  const unread = item.unread;
                  return (
                    <div
                      key={id}
                      className={`subway-station ${isStationActive ? "active" : ""} ${unread ? "unread" : ""}`}
                      onClick={() => onSelectChannel({ id, name: item.name })}
                    >
                      <div
                        className="subway-station-dot"
                        style={{ borderColor: color }}
                      />
                      <span className="subway-station-name">
                        {item.name.length > 24 ? item.name.slice(0, 22) + "…" : item.name}
                      </span>
                      {unread && <span className="subway-station-badge">●</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="nav-container wide">
      <div className="nav-header">Subway</div>
      <div className="nav-canvas subway-canvas">
        {servers.map(renderLine)}
      </div>
    </div>
  );
}
