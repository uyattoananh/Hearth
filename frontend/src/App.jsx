import { useState, useEffect } from "react";
import useWebSocket from "./hooks/useWebSocket";
import useConversations from "./hooks/useConversations";
import Sidebar from "./components/Sidebar";
import MapNav from "./components/nav/MapNav";
import SubwayNav from "./components/nav/SubwayNav";
import HexNav from "./components/nav/HexNav";
import TelescopeNav from "./components/nav/TelescopeNav";
import MessageArea from "./components/MessageArea";
import InputArea from "./components/InputArea";
import Titlebar from "./components/Titlebar";

function applyTheme(theme) {
  if (theme && theme !== "default") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

const NAV_COMPONENTS = {
  list: Sidebar,
  map: MapNav,
  subway: SubwayNav,
  hex: HexNav,
  telescope: TelescopeNav,
};

export default function App() {
  const { state, dispatch, handleWSMessage } = useConversations();
  const { status: wsStatus, send } = useWebSocket(handleWSMessage);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("discord-dm-theme") || "default";
    // Migrate old "bonfire" theme to "dearfriend" (renamed)
    return saved === "bonfire" ? "dearfriend" : saved;
  });

  const [navMode, setNavMode] = useState(() => {
    return localStorage.getItem("discord-dm-nav-mode") || "list";
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("discord-dm-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("discord-dm-nav-mode", navMode);
  }, [navMode]);

  const activeMessages = state.activeId
    ? state.messages[state.activeId] || []
    : [];

  const handleSelectServer = (serverId) => {
    dispatch({ type: "SET_ACTIVE_SERVER", payload: serverId });
    send({ type: "navigate_server", data: { server_id: serverId } });
  };

  const handleSelectChannel = (conv) => {
    dispatch({
      type: "SET_ACTIVE",
      payload: { id: conv.id, name: conv.name },
    });
    send({ type: "navigate", data: { conversation_id: conv.id } });
  };

  const handleSend = (content) => {
    if (!state.activeId || !content.trim()) return;
    dispatch({ type: "SET_SENDING", payload: true });
    send({
      type: "send_message",
      data: { conversation_id: state.activeId, content },
    });
  };

  const handleReply = (msg) => {
    setEditingMsg(null);
    setReplyingTo(msg);
  };

  const handleEdit = (msg) => {
    setReplyingTo(null);
    setEditingMsg(msg);
  };

  const handleReact = (messageId, emoji) => {
    send({ type: "add_reaction", data: { messageId, emoji } });
  };

  const handleReplySend = (messageId, content) => {
    send({ type: "reply_to", data: { messageId, content } });
    setReplyingTo(null);
  };

  const handleEditSubmit = (messageId, content) => {
    send({ type: "edit_message", data: { messageId, content } });
    setEditingMsg(null);
  };

  const handleUploadFile = (filePath) => {
    send({ type: "upload_file", data: { filePath } });
  };

  const NavComponent = NAV_COMPONENTS[navMode] || Sidebar;

  return (
    <div className="app-shell">
      <Titlebar
        wsStatus={wsStatus}
        discordConnected={state.discordConnected}
        theme={theme}
        onThemeChange={setTheme}
        navMode={navMode}
        onNavModeChange={setNavMode}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />
      <div className="app-body">
        {sidebarOpen && (
          <NavComponent
            servers={state.servers}
            conversations={state.conversations}
            channels={state.channels}
            activeServerId={state.activeServerId}
            activeChannelId={state.activeId}
            onSelectServer={handleSelectServer}
            onSelectChannel={handleSelectChannel}
          />
        )}
        <div className="app-main">
          {state.activeName && (
            <div className="channel-header">
              <span className="channel-header-name">
                {state.activeServerId && state.activeServerId !== "home" ? "#" : "@"}
                {state.activeName}
              </span>
            </div>
          )}
          <MessageArea
            messages={activeMessages}
            typing={state.typing}
            onReply={handleReply}
            onEdit={handleEdit}
            onReact={handleReact}
          />
          <InputArea
            onSend={handleSend}
            onReply={handleReplySend}
            onCancelReply={() => setReplyingTo(null)}
            onUploadFile={handleUploadFile}
            disabled={!state.activeId}
            placeholder={
              state.activeName
                ? `Message ${state.activeServerId && state.activeServerId !== "home" ? "#" : "@"}${state.activeName}`
                : "Select a channel"
            }
            replyingTo={replyingTo}
            editingMsg={editingMsg}
            onCancelEdit={() => setEditingMsg(null)}
            onEditSubmit={handleEditSubmit}
          />
        </div>
      </div>
    </div>
  );
}
