export default function StatusBar({ wsStatus, discordConnected, activeName }) {
  return (
    <div className="status-bar-inner">
      <div className="status-indicators">
        <span className={`indicator ${wsStatus === "connected" ? "ok" : "err"}`}>
          WS: {wsStatus}
        </span>
        <span className={`indicator ${discordConnected ? "ok" : "err"}`}>
          Discord: {discordConnected ? "connected" : "disconnected"}
        </span>
      </div>
      {activeName && (
        <div className="active-conv">
          Viewing: <strong>@{activeName}</strong>
        </div>
      )}
    </div>
  );
}
