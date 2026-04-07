/**
 * Honeycomb grid: each conversation is a hexagonal tile.
 * Servers are clusters with their channels grouped together.
 * Tile size adapts to total item count.
 */

// Pick tile dimensions based on item count to fit nicely in 380px container
function pickHexSize(count) {
  if (count <= 6) return { w: 100, h: 114, font: 12, lines: 4, row: 5, offset: 52 };
  if (count <= 12) return { w: 84, h: 96, font: 11, lines: 4, row: 4, offset: 44 };
  if (count <= 24) return { w: 70, h: 80, font: 10, lines: 3, row: 4, offset: 36 };
  if (count <= 48) return { w: 58, h: 66, font: 9, lines: 3, row: 5, offset: 30 };
  return { w: 48, h: 56, font: 8, lines: 2, row: 6, offset: 25 };
}

export default function HexNav({
  servers,
  conversations,
  channels,
  activeServerId,
  activeChannelId,
  onSelectServer,
  onSelectChannel,
}) {
  const renderHex = (item, isServer = false, isActive = false) => {
    const id = item.id || item.channelId;
    const click = isServer
      ? () => onSelectServer(id)
      : () => onSelectChannel({ id, name: item.name });

    return (
      <div
        key={id}
        className={`hex-tile ${isActive ? "active" : ""} ${item.unread ? "unread" : ""}`}
        onClick={click}
        title={item.name}
      >
        {item.iconUrl ? (
          <img src={item.iconUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="hex-tile-label">{item.name || ""}</span>
        )}
      </div>
    );
  };

  // Group items into honeycomb rows
  const renderHoneycomb = (items, isServerRow = false) => {
    const size = pickHexSize(items.length);
    const rows = [];
    let i = 0;
    while (i < items.length) {
      const rowSize = rows.length % 2 === 0 ? size.row : size.row - 1;
      rows.push(items.slice(i, i + rowSize));
      i += rowSize;
    }
    return (
      <div
        className="hex-grid"
        style={{
          "--hex-w": `${size.w}px`,
          "--hex-h": `${size.h}px`,
          "--hex-font": `${size.font}px`,
          "--hex-lines": size.lines,
          "--hex-offset": `${size.offset}px`,
          "--hex-overlap": `${Math.round(size.h * 0.27)}px`,
        }}
      >
        {rows.map((row, ri) => (
          <div className="hex-row" key={ri}>
            {row.map((item) => {
              const id = item.id || item.channelId;
              const isActive = isServerRow
                ? id === activeServerId
                : id === activeChannelId;
              return renderHex(item, isServerRow, isActive);
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="nav-container wide">
      <div className="nav-header">Honeycomb</div>
      <div className="hex-scroll">
        <div className="hex-cluster">
          <div className="hex-cluster-title">Servers</div>
          {renderHoneycomb(servers, true)}
        </div>

        {activeServerId === "home" || !activeServerId ? (
          <div className="hex-cluster">
            <div className="hex-cluster-title">Direct Messages</div>
            {renderHoneycomb(conversations, false)}
          </div>
        ) : (
          <div className="hex-cluster">
            <div className="hex-cluster-title">Channels</div>
            {renderHoneycomb(channels, false)}
          </div>
        )}
      </div>
    </div>
  );
}
