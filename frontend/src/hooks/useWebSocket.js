import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://127.0.0.1:8000/ws";
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

export default function useWebSocket(onMessage) {
  const [status, setStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const retriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      retriesRef.current = 0;
      // Request servers immediately on connect
      ws.send(JSON.stringify({ type: "request_servers" }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current?.(msg);
      } catch {}
    };

    ws.onclose = () => {
      setStatus("disconnected");
      const delay =
        RECONNECT_DELAYS[
          Math.min(retriesRef.current, RECONNECT_DELAYS.length - 1)
        ];
      retriesRef.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, send };
}
