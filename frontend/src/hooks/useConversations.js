import { useReducer, useCallback } from "react";

const initialState = {
  servers: [],
  conversations: [],
  channels: [],
  activeServerId: "home",
  activeId: null,
  activeName: null,
  messages: {},
  discordConnected: false,
  sending: false,
  typing: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SERVERS":
      return { ...state, servers: action.payload };

    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };

    case "SET_CHANNELS":
      return { ...state, channels: action.payload };

    case "SET_MESSAGES":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversation_id]: action.payload.messages,
        },
        activeId: action.payload.conversation_id,
        activeName: action.payload.conversation_name,
        activeServerId: action.payload.server_id || state.activeServerId,
      };

    case "SET_ACTIVE":
      return {
        ...state,
        activeId: action.payload.id,
        activeName: action.payload.name,
      };

    case "SET_ACTIVE_SERVER":
      return {
        ...state,
        activeServerId: action.payload,
        channels: [],
      };

    case "SET_STATUS":
      return {
        ...state,
        discordConnected: action.payload.discord_connected,
        activeId: action.payload.active_conversation_id || state.activeId,
        activeName: action.payload.active_conversation || state.activeName,
        activeServerId: action.payload.active_server_id || state.activeServerId,
      };

    case "SET_SENDING":
      return { ...state, sending: action.payload };

    case "SET_TYPING":
      return { ...state, typing: action.payload };

    default:
      return state;
  }
}

export default function useConversations() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleWSMessage = useCallback((msg) => {
    switch (msg.type) {
      case "servers_list":
        dispatch({ type: "SET_SERVERS", payload: msg.data.servers });
        break;

      case "conversations_list":
        dispatch({ type: "SET_CONVERSATIONS", payload: msg.data.conversations });
        break;

      case "channels_list":
        dispatch({ type: "SET_CHANNELS", payload: msg.data.channels });
        break;

      case "messages_update":
        dispatch({ type: "SET_MESSAGES", payload: msg.data });
        break;

      case "status":
        dispatch({ type: "SET_STATUS", payload: msg.data });
        break;

      case "send_result":
        dispatch({ type: "SET_SENDING", payload: false });
        break;

      case "typing":
        dispatch({ type: "SET_TYPING", payload: msg.data.text || "" });
        break;
    }
  }, []);

  return { state, dispatch, handleWSMessage };
}
