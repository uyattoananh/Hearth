import { useState, useMemo, useRef } from "react";

/**
 * Solar System Telescope:
 * Each server is a glowing sun. Its channels orbit it as planets.
 * Click a sun to "lock on" — it grows and all channels orbit clearly.
 */

const PLANET_COLORS = [
  "#ff7755", "#55ddff", "#aaff66", "#ffcc55",
  "#ff66cc", "#66ffcc", "#cc88ff", "#ffaa66",
];

function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PLANET_COLORS[Math.abs(h) % PLANET_COLORS.length];
}

function sunColorFor(id) {
  if (id === "home") return "#ffeb55";
  let h = 0;
  for (const c of String(id)) h = (h * 17 + c.charCodeAt(0)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

export default function TelescopeNav({
  servers,
  conversations,
  channels,
  activeServerId,
  activeChannelId,
  onSelectServer,
  onSelectChannel,
}) {
  const [focusedId, setFocusedId] = useState(null);
  const [paused, setPaused] = useState(false);

  // Random scattered positions with collision avoidance (Poisson-disk-like)
  const positions = useMemo(() => {
    const map = {};
    const placed = [];
    const minWidth = 380;
    const totalHeight = Math.max(700, servers.length * 110);
    const margin = 60;

    // Seedable PRNG from server index for stable positions
    const rand = (seed) => {
      let h = seed;
      for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0;
      // Mulberry32-ish
      return () => {
        h = (h + 0x6D2B79F5) | 0;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    servers.forEach((s) => {
      const r = rand(s.id);
      // Vary size first (60-110px)
      const size = 60 + Math.floor(r() * 50);

      // Try up to 30 random positions, pick one that doesn't collide
      let best = null;
      let bestDist = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = margin + r() * (minWidth - 2 * margin);
        const y = margin + r() * (totalHeight - 2 * margin);

        // Find min distance to any placed system
        let minDist = Infinity;
        for (const p of placed) {
          const dx = p.x - x;
          const dy = p.y - y;
          const d = Math.sqrt(dx * dx + dy * dy) - (p.size + size) / 2;
          if (d < minDist) minDist = d;
        }

        // Prefer positions farthest from neighbors
        if (minDist > bestDist) {
          bestDist = minDist;
          best = { x, y };
        }

        // If we found one with enough breathing room, take it
        if (minDist > 25) break;
      }

      placed.push({ ...best, size });
      map[s.id] = { ...best, size };
    });

    return map;
  }, [servers]);

  // Render a single mini solar system (galaxy view)
  const renderMiniSystem = (server) => {
    const pos = positions[server.id];
    if (!pos) return null;
    const isActive = server.id === activeServerId;
    const sunColor = sunColorFor(server.id);
    const size = pos.size;
    const sunSize = Math.round(size * 0.32);
    const ring1 = Math.round(size * 0.55);
    const ring2 = Math.round(size * 0.78);
    const orbitRadius = Math.round(size * 0.35);

    return (
      <div
        key={server.id}
        className="solar-mini"
        style={{
          left: pos.x - size / 2,
          top: pos.y - size / 2,
          width: size,
          height: size + 14,
        }}
        onClick={() => {
          setFocusedId(server.id);
          onSelectServer(server.id);
        }}
      >
        {/* Orbital rings */}
        <div className="solar-orbit-ring" style={{ width: ring1, height: ring1 }} />
        <div className="solar-orbit-ring" style={{ width: ring2, height: ring2 }} />

        {/* Sun */}
        <div
          className={`solar-sun ${isActive ? "active" : ""}`}
          style={{
            width: sunSize,
            height: sunSize,
            fontSize: Math.max(9, sunSize / 2.2),
            background: sunColor,
            boxShadow: `0 0 ${sunSize}px ${sunColor}, 0 0 ${sunSize * 2}px ${sunColor}80`,
          }}
        >
          {server.iconUrl ? (
            <img src={server.iconUrl} alt="" />
          ) : (
            <span>{server.id === "home" ? "@" : server.name.charAt(0)}</span>
          )}
        </div>

        {/* Mini decorative planets — varying count by size */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="solar-planet-mini"
            style={{
              "--mini-radius": `${orbitRadius + i * 4}px`,
              animation: `orbitMini ${5 + i * 2}s linear infinite`,
              animationDelay: `${-i * 1.7}s`,
              background: PLANET_COLORS[(i + Math.abs(server.id.charCodeAt(0))) % PLANET_COLORS.length],
            }}
          />
        ))}

        {/* Label */}
        <div className="solar-label">{server.name.slice(0, 12)}</div>
      </div>
    );
  };

  // Render focused solar system (zoomed in)
  const renderFocusedSystem = () => {
    const server = servers.find((s) => s.id === focusedId);
    if (!server) return null;
    const items = focusedId === "home" ? conversations : channels;
    const sunColor = sunColorFor(server.id);

    const cx = 190;
    const cy = 280;

    return (
      <div className="solar-focused">
        <button className="solar-back-btn" onClick={() => setFocusedId(null)}>
          {"\u2190 Galaxy"}
        </button>

        {/* Multiple orbital rings */}
        {[80, 130, 180, 230].map((r) => (
          <div
            key={r}
            className="solar-orbit-ring"
            style={{
              left: cx - r / 2,
              top: cy - r / 2,
              width: r,
              height: r,
            }}
          />
        ))}

        {/* Central sun */}
        <div
          className="solar-sun-big"
          style={{
            left: cx - 30,
            top: cy - 30,
            background: `radial-gradient(circle at 35% 35%, #fff, ${sunColor} 60%, ${sunColor}88)`,
            boxShadow: `0 0 40px ${sunColor}, 0 0 80px ${sunColor}80`,
          }}
        >
          {server.iconUrl && <img src={server.iconUrl} alt="" />}
        </div>
        <div className="solar-sun-label" style={{ left: cx - 60, top: cy + 36 }}>
          {server.name}
        </div>

        {/* Planets orbiting */}
        {items.slice(0, 16).map((item, i) => {
          const id = item.id || item.channelId;
          const isActive = id === activeChannelId;
          const ringIdx = i % 4;
          const radius = [40, 65, 90, 115][ringIdx];
          const speed = 12 + ringIdx * 6;
          const delay = -(i * 1.5);
          const planetColor = colorFor(id);

          return (
            <div
              key={id}
              className="solar-planet-orbit"
              style={{
                left: cx,
                top: cy,
                animation: `orbitFull ${speed}s linear infinite`,
                animationDelay: `${delay}s`,
              }}
            >
              <div
                className="solar-planet-counter"
                style={{
                  "--radius": `${radius}px`,
                  animation: `counterRotate ${speed}s linear infinite`,
                  animationDelay: `${delay}s`,
                }}
              >
                <div
                  className={`solar-planet ${isActive ? "active" : ""}`}
                  style={{
                    background: planetColor,
                    boxShadow: `0 0 8px ${planetColor}`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChannel({ id, name: item.name });
                  }}
                  title={item.name}
                />
                <span className="solar-planet-label">
                  {item.name.slice(0, 14)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="nav-container wide">
      <div className="nav-header">Solar System</div>
      <div
        className={`nav-canvas solar-canvas ${paused ? "paused" : ""}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {focusedId ? renderFocusedSystem() : (
          <div className="solar-galaxy">
            {servers.map(renderMiniSystem)}
          </div>
        )}
      </div>
    </div>
  );
}
