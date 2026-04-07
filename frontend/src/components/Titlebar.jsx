import { useState, useEffect } from "react";
import ThemePicker from "./ThemePicker";
import NavModePicker from "./NavModePicker";

export default function Titlebar({
  wsStatus,
  discordConnected,
  theme,
  onThemeChange,
  navMode,
  onNavModeChange,
  onToggleSidebar,
  sidebarOpen,
}) {
  const connected = wsStatus === "connected" && discordConnected;
  const [maximized, setMaximized] = useState(true);

  // Set fullscreen class on mount since the window starts maximized
  useEffect(() => {
    document.documentElement.classList.add("is-fullscreen");
  }, []);

  const toggleFullscreen = async () => {
    if (window.electronAPI?.toggleFullscreen) {
      const result = await window.electronAPI.toggleFullscreen();
      setMaximized(result);
      document.documentElement.classList.toggle("is-fullscreen", result);
    }
  };

  const minimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <button className="titlebar-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          {"\u2630"}
        </button>
        <span className={`titlebar-dot ${connected ? "ok" : "err"}`} />
        <span className="titlebar-title">Discord</span>
      </div>
      <div className="titlebar-right">
        <NavModePicker current={navMode} onChange={onNavModeChange} />
        <button className="titlebar-btn" onClick={minimize} title="Minimize">
          {"\u2014"}
        </button>
        <button className="titlebar-btn" onClick={toggleFullscreen} title={maximized ? "Restore" : "Fullscreen"}>
          {maximized ? "\u2716" : "\u26F6"}
        </button>
        <ThemePicker current={theme} onChange={onThemeChange} />
      </div>
    </div>
  );
}
