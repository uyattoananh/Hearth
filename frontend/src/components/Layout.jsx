export default function Layout({ sidebar, main, statusBar }) {
  return (
    <div className="app-layout">
      <div className="status-bar">{statusBar}</div>
      <div className="main-container">
        <div className="sidebar">{sidebar}</div>
        <div className="main-panel">{main}</div>
      </div>
    </div>
  );
}
