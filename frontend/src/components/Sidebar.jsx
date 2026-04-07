import { useState } from "react";

const STATUS_COLORS = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
};

const CHANNEL_ICONS = {
  text: "#",
  voice: "\uD83D\uDD0A",
  announcement: "\uD83D\uDCE2",
  forum: "\uD83D\uDCAC",
  stage: "\uD83C\uDFA4",
};

export default function Sidebar({
  servers,
  conversations,
  channels,
  activeServerId,
  activeChannelId,
  onSelectServer,
  onSelectChannel,
}) {
  const [search, setSearch] = useState("");
  const isDmView = !activeServerId || activeServerId === "home";

  const filteredConvos = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sidebar-container">
      {/* Server icon strip */}
      <div className="server-strip">
        {servers.map((s) => (
          <div
            key={s.id}
            className={`server-icon ${(activeServerId || "home") === s.id ? "active" : ""} ${s.unread ? "unread" : ""}`}
            onClick={() => onSelectServer(s.id)}
            title={s.name}
          >
            {s.iconUrl ? (
              <img src={s.iconUrl} alt="" className="server-img" />
            ) : (
              <span className="server-letter">
                {s.id === "home" ? "\uD83D\uDCAC" : s.name.charAt(0)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Channel/DM list */}
      <div className="channel-list">
        <input
          className="channel-search"
          placeholder={isDmView ? "Search DMs..." : "Search channels..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {isDmView ? (
          /* DM list */
          <div className="channel-items">
            {filteredConvos.map((c) => (
              <div
                key={c.id}
                className={`channel-item ${c.id === activeChannelId ? "active" : ""}`}
                onClick={() => onSelectChannel(c)}
              >
                <div className="dm-avatar-wrap">
                  <div className="dm-avatar">
                    {c.iconUrl ? (
                      <img src={c.iconUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      c.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span
                    className="dm-status"
                    style={{ background: STATUS_COLORS[c.status] || STATUS_COLORS.offline }}
                  />
                </div>
                <span className="channel-name">{c.name}</span>
              </div>
            ))}
            {filteredConvos.length === 0 && (
              <div className="channel-empty">
                {conversations.length === 0 ? "Loading..." : "No matches"}
              </div>
            )}
          </div>
        ) : (
          /* Server channel list */
          <div className="channel-items">
            {filteredChannels.map((ch) => (
              <div
                key={ch.channelId}
                className={`channel-item ${ch.channelId === activeChannelId ? "active" : ""} ${ch.locked ? "locked" : ""}`}
                onClick={() => onSelectChannel({ id: ch.channelId, name: ch.name })}
              >
                <span className="channel-type-icon">
                  {CHANNEL_ICONS[ch.type] || "#"}
                </span>
                <span className="channel-name">{ch.name}</span>
                {ch.locked && <span className="channel-lock">{"\uD83D\uDD12"}</span>}
              </div>
            ))}
            {filteredChannels.length === 0 && (
              <div className="channel-empty">
                {channels.length === 0 ? "Loading..." : "No matches"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
