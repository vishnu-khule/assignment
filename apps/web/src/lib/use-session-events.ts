import { useEffect } from "react";
import { mapBackendStatus } from "./session-status";
import type { UiStatus } from "../store/session-ui";

const WS_BASE =
  import.meta.env.VITE_WS_BASE ??
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/v1/ws`;

export function useSessionEvents(
  sessionId: string | null,
  onStep: (status: UiStatus, message?: string) => void,
  onAgent?: (payload: {
    agent_step?: string;
    agent_tool?: string;
    phase?: string;
  }) => void,
) {
  useEffect(() => {
    if (!sessionId) return;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_BASE);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ event: "subscribe", data: { session_id: sessionId } }));
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as {
            type?: string;
            session_id?: string;
            step?: string;
            message?: string;
            payload?: {
              agent_step?: string;
              agent_tool?: string;
              phase?: string;
            };
          };
          if (data.type !== "session.event" || data.session_id !== sessionId) return;
          if (data.payload) onAgent?.(data.payload);
          if (data.step) onStep(mapBackendStatus(data.step), data.message);
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* WS optional in dev */
    }

    return () => {
      ws?.close();
    };
  }, [sessionId, onStep, onAgent]);
}
