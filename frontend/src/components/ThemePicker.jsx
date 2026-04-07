import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const THEMES = [
  { id: "default", label: "Default", color: "#0a0a0a" },
  { id: "light", label: "Light", color: "#f5f5f7" },
  { id: "xp", label: "XP", color: "#0997ff" },
  { id: "neon", label: "Neon", color: "#ff00ff" },
  { id: "radio", label: "Radio", color: "#1c1410" },
  { id: "retro", label: "Retro", color: "#FFF5D5" },
  { id: "terminal", label: "Terminal", color: "#1db954" },
  { id: "bloom", label: "Bloom", color: "#c4a0e8" },
  { id: "starry", label: "Starry", color: "#0a0a2e" },
  { id: "ziro", label: "Ziro", color: "#15a4ef" },
  { id: "dearfriend", label: "Dear Friend", color: "#ff9933" },
  { id: "glass", label: "Glass", color: "rgba(255,255,255,0.3)" },
  { id: "vinyl", label: "Vinyl", color: "#d4a050" },
  { id: "spacestation", label: "Station", color: "#00ff66" },
  { id: "polaroid", label: "Polaroid", color: "#c4a882" },
  { id: "arcade", label: "Arcade", color: "#ffee55" },
  { id: "ocean", label: "Ocean", color: "#00ddff" },
  { id: "neonalley", label: "Neon Alley", color: "#ff44aa" },
  { id: "jpgarden", label: "Garden", color: "#88cc55" },
  { id: "library", label: "Library", color: "#d4a050" },
  { id: "treehouse", label: "Treehouse", color: "#88cc55" },
  { id: "ruins", label: "Ruins", color: "#60c8b0" },
];

export default function ThemePicker({ current, onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!e.target.closest(".theme-picker") && !e.target.closest(".titlebar-btn")) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        className="titlebar-btn"
        onClick={() => setOpen(!open)}
        title="Theme"
      >
        &#x1F3A8;
      </button>
      {open &&
        createPortal(
          <div className="theme-picker">
            {THEMES.map((t) => (
              <div
                key={t.id}
                className={`theme-swatch ${current === t.id ? "active" : ""}`}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
              >
                <div className="theme-dot" style={{ background: t.color }} />
                <span className="theme-label">{t.label}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
