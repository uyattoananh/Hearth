import { useState, useMemo } from "react";

/**
 * Map view: servers laid out as islands on a hand-drawn parchment map.
 * Each server gets a unique deterministic position based on its ID hash.
 */
export default function MapNav({
  servers,
  conversations,
  channels,
  activeServerId,
  activeChannelId,
  onSelectServer,
  onSelectChannel,
}) {
  const [zoomedServerId, setZoomedServerId] = useState(null);

  const W = 280;
  const H = 600;

  // Assign unique grid cells to each server (no overlaps)
  const positions = useMemo(() => {
    const map = {};
    const cols = 3;
    const cellW = 80;
    const cellH = 75;
    const startX = 50;
    const startY = 55;

    servers.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Stagger every other row for organic look
      const offsetX = (row % 2) * 25;
      // Hash for slight jitter within the cell
      let h = 0;
      for (const c of String(s.id)) h = (h * 31 + c.charCodeAt(0)) | 0;
      const jitterX = ((Math.abs(h) % 20) - 10);
      const jitterY = ((Math.abs(h * 7) % 16) - 8);
      map[s.id] = {
        x: startX + col * cellW + offsetX + jitterX,
        y: startY + row * cellH + jitterY,
      };
    });
    return map;
  }, [servers]);

  // Generate a wavy island shape path
  const islandPath = (cx, cy, r, seed) => {
    const points = [];
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * 2 * Math.PI;
      const variance = 0.7 + ((seed + i * 13) % 60) / 100;
      const px = cx + Math.cos(angle) * r * variance;
      const py = cy + Math.sin(angle) * r * variance;
      points.push(`${px},${py}`);
    }
    return `M${points.join(" L")} Z`;
  };

  const renderServerMap = () => {
    return (
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          {/* Parchment texture */}
          <pattern id="parchment" patternUnits="userSpaceOnUse" width="40" height="40">
            <rect width="40" height="40" fill="#3a2818" />
            <circle cx="10" cy="10" r="0.5" fill="#5a3a20" opacity="0.5" />
            <circle cx="30" cy="20" r="0.5" fill="#5a3a20" opacity="0.5" />
            <circle cx="20" cy="35" r="0.5" fill="#5a3a20" opacity="0.5" />
          </pattern>
          {/* Wave pattern for sea */}
          <pattern id="waves" patternUnits="userSpaceOnUse" width="40" height="20">
            <path d="M 0 10 Q 10 5, 20 10 T 40 10" stroke="#2a4060" fill="none" strokeWidth="0.5" opacity="0.4" />
          </pattern>
        </defs>

        {/* Sea background */}
        <rect width={W} height={H} fill="#1a2840" />
        <rect width={W} height={H} fill="url(#waves)" />

        {/* Compass rose */}
        <g transform={`translate(${W - 32}, 32)`} opacity="0.6">
          <circle r="18" fill="none" stroke="#d4a050" strokeWidth="0.8" />
          <circle r="14" fill="none" stroke="#d4a050" strokeWidth="0.4" />
          <path d="M 0 -16 L 3 0 L 0 16 L -3 0 Z" fill="#d4a050" />
          <path d="M -16 0 L 0 3 L 16 0 L 0 -3 Z" fill="#d4a050" opacity="0.7" />
          <text y="-20" textAnchor="middle" fontSize="7" fill="#d4a050">N</text>
        </g>

        {/* Title */}
        <text x="10" y="20" fontSize="9" fill="#d4a050" fontFamily="Georgia, serif" fontStyle="italic">
          ~ Servers ~
        </text>

        {/* Decorative path lines connecting islands */}
        {servers.length > 1 && servers.slice(1).map((s, i) => {
          const prev = servers[i];
          const a = positions[prev.id];
          const b = positions[s.id];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2 + ((i % 2) ? 15 : -15);
          const my = (a.y + b.y) / 2 + ((i % 2) ? -10 : 10);
          return (
            <path
              key={`path-${s.id}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`}
              stroke="#d4a050"
              strokeWidth="0.6"
              strokeDasharray="2 3"
              fill="none"
              opacity="0.4"
            />
          );
        })}

        {/* Islands */}
        {servers.map((s, i) => {
          const pos = positions[s.id];
          if (!pos) return null;
          const isActive = activeServerId === s.id;
          const r = isActive ? 22 : 18;
          let seed = 0;
          for (const c of String(s.id)) seed += c.charCodeAt(0);

          return (
            <g
              key={s.id}
              className={`map-node ${isActive ? "active" : ""} ${s.unread ? "unread" : ""}`}
              onClick={() => {
                onSelectServer(s.id);
                setZoomedServerId(s.id);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Island shape (sand) */}
              <path
                d={islandPath(pos.x, pos.y, r + 4, seed)}
                fill="#d4b078"
                opacity="0.4"
              />
              {/* Island top (grass) */}
              <path
                d={islandPath(pos.x, pos.y, r, seed + 7)}
                fill={isActive ? "#7aa050" : "#5a8030"}
                stroke={isActive ? "#fff" : "#3a5018"}
                strokeWidth={isActive ? 1.5 : 0.8}
              />
              {/* Server icon clipped to circle */}
              {s.iconUrl && (
                <>
                  <defs>
                    <clipPath id={`clip-${s.id}`}>
                      <circle cx={pos.x} cy={pos.y} r="10" />
                    </clipPath>
                  </defs>
                  <image
                    href={s.iconUrl}
                    x={pos.x - 10}
                    y={pos.y - 10}
                    width="20"
                    height="20"
                    clipPath={`url(#clip-${s.id})`}
                  />
                </>
              )}
              {!s.iconUrl && (
                <text
                  x={pos.x}
                  y={pos.y + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#fff"
                >
                  {s.id === "home" ? "@" : s.name.charAt(0)}
                </text>
              )}
              {/* Label below */}
              <text
                x={pos.x}
                y={pos.y + r + 10}
                textAnchor="middle"
                fontSize="8"
                fill="#f0e0b0"
                fontFamily="Georgia, serif"
                fontStyle="italic"
                stroke="#1a2840"
                strokeWidth="2"
                paintOrder="stroke"
              >
                {s.name.slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Channel detail view (zoomed in)
  const renderChannelMap = () => {
    const items = zoomedServerId === "home" ? conversations : channels;
    const server = servers.find((s) => s.id === zoomedServerId);
    const cx = W / 2;
    const cy = H / 2;
    const radius = 90;

    return (
      <>
        <button className="map-back-btn" onClick={() => setZoomedServerId(null)}>
          {"\u2190 World Map"}
        </button>
        <svg className="map-svg" viewBox={`0 0 ${W} ${H}`}>
          {/* Aged paper background for the detail view */}
          <rect width={W} height={H} fill="#3a2818" />
          <rect width={W} height={H} fill="url(#waves)" opacity="0.2" />

          {/* Title scroll */}
          <text x={cx} y="22" textAnchor="middle" fontSize="11" fill="#d4a050" fontFamily="Georgia, serif" fontStyle="italic">
            ~ {server?.name?.slice(0, 20) || "Region"} ~
          </text>

          {/* Center server "capital city" */}
          <g>
            <circle cx={cx} cy={cy} r="28" fill="#5a8030" stroke="#d4a050" strokeWidth="2" />
            {server?.iconUrl && (
              <>
                <defs>
                  <clipPath id="clip-center">
                    <circle cx={cx} cy={cy} r="22" />
                  </clipPath>
                </defs>
                <image
                  href={server.iconUrl}
                  x={cx - 22}
                  y={cy - 22}
                  width="44"
                  height="44"
                  clipPath="url(#clip-center)"
                />
              </>
            )}
          </g>

          {/* Channels as outpost towns */}
          {items.slice(0, 16).map((item, i) => {
            const total = Math.min(items.length, 16);
            const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const id = item.id || item.channelId;
            const isActive = id === activeChannelId;

            return (
              <g key={id}>
                {/* Path from city to outpost */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="#d4a050"
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                  opacity="0.5"
                />
                {/* Outpost */}
                <g
                  className={`map-node ${isActive ? "active" : ""}`}
                  onClick={() => onSelectChannel({ id, name: item.name })}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 9 : 7}
                    fill={isActive ? "#d4a050" : "#8a6030"}
                    stroke={isActive ? "#fff" : "#3a2010"}
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={y + 18}
                    textAnchor="middle"
                    fontSize="7"
                    fill="#f0e0b0"
                    fontFamily="Georgia, serif"
                    stroke="#3a2818"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {item.name.slice(0, 12)}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </>
    );
  };

  return (
    <div className="nav-container">
      <div className="nav-header">Map</div>
      <div className="nav-canvas">
        {zoomedServerId ? renderChannelMap() : renderServerMap()}
      </div>
    </div>
  );
}
