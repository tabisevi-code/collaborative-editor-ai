import type { ApiClient } from "./api";
import type { DocumentRole, TextSelection } from "../types/api";

export type RealtimeConnectionState = "idle" | "connecting" | "connected" | "error" | "closed";

export interface PresenceEvent {
  documentId: string;
  userId: string;
  cursor?: number | null;
  selection?: TextSelection | null;
}

export interface RealtimeClientOptions {
  userId: string;
  onConnectionStateChange?(state: RealtimeConnectionState): void;
  onSessionReady?(payload: { sessionId: string; documentId: string; userId: string; role: DocumentRole }): void;
  onPresenceJoin?(payload: { documentId: string; userId: string }): void;
  onPresenceLeave?(payload: { documentId: string; userId: string }): void;
  onPresence?(payload: PresenceEvent): void;
  onPermissionUpdated?(): void;
  onDocumentReverted?(): void;
  onAccessRevoked?(): void;
  onError?(message: string): void;
}

export interface RealtimeService {
  connect(documentId: string, options: RealtimeClientOptions): Promise<void>;
  sendPresence(payload: { cursor?: number | null; selection?: TextSelection | null }): void;
  disconnect(): void;
}

type RealtimeMessage =
  | { type: "session_ready"; sessionId: string; documentId: string; userId: string; role: DocumentRole }
  | { type: "presence_join"; documentId: string; userId: string }
  | { type: "presence_leave"; documentId: string; userId: string }
  | { type: "presence"; documentId: string; userId: string; cursor?: number | null; selection?: TextSelection | null }
  | { type: "permission_updated"; documentId: string }
  | { type: "document_reverted"; documentId: string }
  | { type: "access_revoked"; documentId: string; targetUserId: string }
  | { type: "error"; message?: string };

/**
 * A tiny websocket client keeps document pages isolated from transport details.
 * The page only consumes state changes and events instead of raw socket frames.
 */
export function createRealtimeService(apiClient: ApiClient): RealtimeService {
  let socket: WebSocket | null = null;
  let activeOptions: RealtimeClientOptions | null = null;
  let reconnectTimeout: number | null = null;

  function updateState(state: RealtimeConnectionState) {
    activeOptions?.onConnectionStateChange?.(state);
  }

  function clearReconnectTimeout() {
    if (reconnectTimeout !== null) {
      window.clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  function disconnect() {
    clearReconnectTimeout();
    if (socket) {
      socket.close();
      socket = null;
    }
    updateState("closed");
  }

  async function connect(documentId: string, options: RealtimeClientOptions) {
    activeOptions = options;

    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      options.onError?.("Realtime is unavailable in this environment.");
      updateState("error");
      return;
    }

    disconnect();
    updateState("connecting");

    try {
      const session = await apiClient.createSession(documentId, options.userId);
      const ws = new WebSocket(session.wsUrl);
      socket = ws;

      ws.onopen = () => {
        updateState("connected");
      };

      ws.onmessage = (event) => {
        let payload: RealtimeMessage;
        try {
          payload = JSON.parse(String(event.data)) as RealtimeMessage;
        } catch (_error) {
          options.onError?.("Realtime returned malformed JSON.");
          return;
        }

        switch (payload.type) {
          case "session_ready":
            options.onSessionReady?.(payload);
            return;
          case "presence_join":
            options.onPresenceJoin?.(payload);
            return;
          case "presence_leave":
            options.onPresenceLeave?.(payload);
            return;
          case "presence":
            options.onPresence?.(payload);
            return;
          case "permission_updated":
            options.onPermissionUpdated?.();
            return;
          case "document_reverted":
            options.onDocumentReverted?.();
            return;
          case "access_revoked":
            options.onAccessRevoked?.();
            return;
          case "error":
            options.onError?.(payload.message || "Realtime request failed.");
            return;
          default:
            return;
        }
      };

      ws.onerror = () => {
        updateState("error");
        options.onError?.("Realtime connection failed.");
      };

      ws.onclose = () => {
        socket = null;
        updateState("closed");
      };
    } catch (error) {
      updateState("error");
      const message = error instanceof Error ? error.message : "Failed to create a realtime session.";
      options.onError?.(message);
    }
  }

  function sendPresence(payload: { cursor?: number | null; selection?: TextSelection | null }) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "presence",
        cursor: payload.cursor ?? null,
        selection: payload.selection ?? null,
      })
    );
  }

  return {
    connect,
    sendPresence,
    disconnect,
  };
}
