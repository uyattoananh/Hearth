import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const MODES = [
  { id: "list", label: "List", icon: "\u2630" },
  { id: "map", label: "Map", icon: "\u{1F5FA}".replace("\u{1F5FA}", "\uD83D\uDDFA") },
  { id: "subway", label: "Subway", icon: "\uD83D\uDE87" },
  { id: "hex", label: "Hex", icon: "\u2B22" },
  { id: "telescope", label: "Telescope", icon: "\uD83D\uDD2D" },
];

export default function NavModePicker({ current, onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!e.target.closest(".nav-mode-picker") && !e.target.closest(".titlebar-btn-nav")) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentMode = MODES.find((m) => m.id === current) || MODES[0];

  return (
    <>
      <button
        className="titlebar-btn titlebar-btn-nav"
        onClick={() => setOpen(!open)}
        title={`Navigation: ${currentMode.label}`}
      >
        {currentMode.icon}
      </button>
      {open &&
        createPortal(
          <div className="nav-mode-picker">
            {MODES.map((m) => (
              <div
                key={m.id}
                className={`nav-mode-item ${current === m.id ? "active" : ""}`}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <span className="nav-mode-icon">{m.icon}</span>
                <span className="nav-mode-label">{m.label}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
