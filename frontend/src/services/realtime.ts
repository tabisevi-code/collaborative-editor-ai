import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

import type { ApiClient } from "./api";
import type { DocumentRole, TextSelection } from "../types/api";

export type RealtimeConnectionState = "idle" | "connecting" | "connected" | "error" | "closed";

export interface RemotePeer {
  clientId: number;
  userId: string;
  color: string;
  role?: DocumentRole;
  cursor?: number | null;
  selection?: TextSelection | null;
}

export interface RealtimeClientOptions {
  userId: string;
  role?: DocumentRole;
  initialContent?: string;
  onConnectionStateChange?(state: RealtimeConnectionState): void;
  onTextChange?(text: string): void;
  onPeersChange?(peers: RemotePeer[]): void;
  onPermissionChange?(role: DocumentRole): void;
  onSessionReady?(payload: { role: DocumentRole; documentId: string; userId: string; sessionId: string }): void;
  onPresenceJoin?(payload: { documentId: string; userId: string }): void;
  onPresenceLeave?(payload: { documentId: string; userId: string }): void;
  onPermissionUpdated?(): void;
  onDocumentReverted?(payload: { documentId: string; currentVersionId?: string; revisionId?: string }): void;
  onAccessRevoked?(): void;
  onError?(message: string): void;
}

export interface RealtimeService {
  connect(documentId: string, options: RealtimeClientOptions): Promise<void>;
  getText(): string;
  applyLocalChange(nextText: string): boolean;
  replaceSelection(selection: TextSelection, replacement: string): boolean;
  setCursorSelection(selection: TextSelection | null): void;
  sendPresence(payload: { cursor?: number | null; selection?: TextSelection | null }): void;
  applyRemoteReset(content: string): void;
  disconnect(): void;
}

type JsonRealtimeMessage =
  | { type: "session_ready"; role: DocumentRole; documentId: string; userId: string; sessionId: string }
  | { type: "presence_join"; documentId: string; userId: string }
  | { type: "presence_leave"; documentId: string; userId: string }
  | { type: "permission_updated"; role?: DocumentRole; documentId: string }
  | { type: "document_reverted"; documentId: string; currentVersionId?: string; revisionId?: string }
  | { type: "access_revoked"; documentId: string; targetUserId: string }
  | { type: "error"; code?: string; message?: string };

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const LOCAL_TEXT_ORIGIN = Symbol("local-text-origin");
const LOCAL_RESET_ORIGIN = Symbol("local-reset-origin");
const RECONNECT_DELAY_MS = 1000;
const REALTIME_PROTOCOL = "collab.realtime.v1";

function mapSelection(selection: TextSelection | null | undefined): TextSelection | null {
  if (!selection) {
    return null;
  }

  return {
    start: selection.start,
    end: selection.end,
  };
}

function derivePeerColor(userId: string): string {
  const palette = ["#1a73e8", "#188038", "#c5221f", "#9334e6", "#b06000", "#00897b"];
  const hash = [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function diffText(currentText: string, nextText: string) {
  let prefixLength = 0;
  const maxPrefix = Math.min(currentText.length, nextText.length);
  while (prefixLength < maxPrefix && currentText[prefixLength] === nextText[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maxSuffix = Math.min(currentText.length - prefixLength, nextText.length - prefixLength);
  while (
    suffixLength < maxSuffix &&
    currentText[currentText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    prefixLength,
    deleteLength: currentText.length - prefixLength - suffixLength,
    insertText: nextText.slice(prefixLength, nextText.length - suffixLength),
  };
}

/**
 * The collaboration client keeps all transport and CRDT details behind a
 * narrow interface so the document page can focus on product behavior.
 */
export function createRealtimeService(apiClient: ApiClient): RealtimeService {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("content");
  const awareness = new Awareness(ydoc);

  let socket: WebSocket | null = null;
  let activeDocumentId: string | null = null;
  let activeOptions: RealtimeClientOptions | null = null;
  let reconnectTimer: number | null = null;
  let currentRole: DocumentRole = "viewer";
  let shouldReconnect = false;
  let collaborationReady = false;
  let connectAttemptId = 0;

  function updateState(state: RealtimeConnectionState) {
    activeOptions?.onConnectionStateChange?.(state);
  }

  function emitPeers() {
    const peers: RemotePeer[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === ydoc.clientID) {
        return;
      }

      if (typeof state.userId !== "string" || state.userId.trim().length === 0) {
        return;
      }

      peers.push({
        clientId,
        userId: state.userId,
        color: typeof state.color === "string" ? state.color : derivePeerColor(String(state.userId || clientId)),
        role: state.role,
        cursor: typeof state.cursor === "number" ? state.cursor : null,
        selection: mapSelection(state.selection),
      });
    });

    activeOptions?.onPeersChange?.(peers);
  }

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function sendBinary(payload: Uint8Array) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(payload);
  }

  function sendSyncStep1() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, ydoc);
    sendBinary(encoding.toUint8Array(encoder));
  }

  function sendAwareness(clientIds: number[]) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, clientIds));
    sendBinary(encoding.toUint8Array(encoder));
  }

  function scheduleReconnect() {
    if (!shouldReconnect || !activeDocumentId || !activeOptions || reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (activeDocumentId && activeOptions) {
        void connect(activeDocumentId, activeOptions);
      }
    }, RECONNECT_DELAY_MS);
  }

  function updateLocalAwareness(selection: TextSelection | null) {
    if (!activeOptions) {
      return;
    }

    const cursor = selection ? selection.end : null;
    awareness.setLocalState({
      userId: activeOptions.userId,
      color: derivePeerColor(activeOptions.userId),
      role: currentRole,
      cursor,
      selection,
    });
  }

  function resetDocumentContent(content: string, origin: unknown) {
    ydoc.transact(() => {
      const current = ytext.toString();
      if (current.length > 0) {
        ytext.delete(0, current.length);
      }
      if (content.length > 0) {
        ytext.insert(0, content);
      }
    }, origin);
  }

  function disconnect() {
    shouldReconnect = false;
    clearReconnectTimer();
    collaborationReady = false;
    awareness.setLocalState(null);

    if (socket) {
      socket.close();
      socket = null;
    }

    updateState("closed");
  }

  async function connect(documentId: string, options: RealtimeClientOptions) {
    const attemptId = ++connectAttemptId;
    activeDocumentId = documentId;
    activeOptions = options;
    currentRole = options.role ?? "viewer";
    shouldReconnect = true;
    clearReconnectTimer();
    collaborationReady = false;

    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      updateState("error");
      options.onError?.("Realtime collaboration is unavailable in this environment.");
      return;
    }

    if (socket) {
      socket.close();
      socket = null;
    }

    updateState("connecting");

    try {
      const session = await apiClient.createSession(documentId, options.userId);
      if (attemptId !== connectAttemptId) {
        return;
      }

      currentRole = session.role;
      options.onPermissionChange?.(session.role);

      const ws = new WebSocket(session.wsUrl, [REALTIME_PROTOCOL, `auth.${session.sessionToken}`]);
      ws.binaryType = "arraybuffer";
      socket = ws;

      ws.onopen = () => {
        if (socket !== ws || attemptId !== connectAttemptId) {
          return;
        }

        console.info("[frontend-realtime] socket_open", { documentId, userId: options.userId });
        sendSyncStep1();
        updateLocalAwareness(null);
      };

      ws.onmessage = (event) => {
        if (socket !== ws || attemptId !== connectAttemptId) {
          return;
        }

        if (typeof event.data === "string") {
          const payload = JSON.parse(event.data) as JsonRealtimeMessage;
          if (payload.type === "session_ready") {
            currentRole = payload.role;
            updateLocalAwareness(mapSelection(awareness.getLocalState()?.selection));
            options.onPermissionChange?.(payload.role);
            options.onSessionReady?.(payload);
            return;
          }

          if (payload.type === "presence_join") {
            options.onPresenceJoin?.(payload);
            return;
          }

          if (payload.type === "presence_leave") {
            options.onPresenceLeave?.(payload);
            return;
          }

          if (payload.type === "permission_updated") {
            if (payload.role) {
              currentRole = payload.role;
              updateLocalAwareness(mapSelection(awareness.getLocalState()?.selection));
              options.onPermissionChange?.(payload.role);
            }
            options.onPermissionUpdated?.();
            return;
          }

          if (payload.type === "document_reverted") {
            options.onDocumentReverted?.(payload);
            return;
          }

          if (payload.type === "access_revoked") {
            currentRole = "viewer";
            updateLocalAwareness(mapSelection(awareness.getLocalState()?.selection));
            options.onPermissionChange?.("viewer");
            shouldReconnect = false;
            options.onAccessRevoked?.();
            return;
          }

          if (payload.type === "error") {
            updateState("error");
            options.onError?.(payload.message || "Realtime collaboration failed.");
          }
          return;
        }

        const data = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : new Uint8Array(event.data);
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_SYNC) {
          syncProtocol.readSyncMessage(decoder, encoding.createEncoder(), ydoc, null);
          if (!collaborationReady) {
            collaborationReady = true;
            updateState("connected");
          }
          return;
        }

        if (messageType === MESSAGE_AWARENESS) {
          const update = decoding.readVarUint8Array(decoder);
          applyAwarenessUpdate(awareness, update, null);
        }
      };

      ws.onerror = () => {
        if (socket !== ws || attemptId !== connectAttemptId) {
          return;
        }

        updateState("error");
        options.onError?.("Realtime connection failed.");
      };

      ws.onclose = () => {
        if (socket !== ws || attemptId !== connectAttemptId) {
          return;
        }

        socket = null;
        updateState("closed");
        emitPeers();
        console.info("[frontend-realtime] socket_closed", { documentId, shouldReconnect });
        if (shouldReconnect) {
          scheduleReconnect();
        }
      };
    } catch (error) {
      updateState("error");
      options.onError?.(error instanceof Error ? error.message : "Failed to create a realtime session.");
      scheduleReconnect();
    }
  }

  ydoc.on("update", (update, origin) => {
    activeOptions?.onTextChange?.(ytext.toString());

    if (origin === LOCAL_TEXT_ORIGIN) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      sendBinary(encoding.toUint8Array(encoder));
    }
  });

  awareness.on(
    "change",
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
    emitPeers();

    const changed = [...added, ...updated, ...removed];
    if (origin === "local") {
      sendAwareness(changed);
    }
    }
  );

  return {
    connect,
    getText() {
      return ytext.toString();
    },
    applyLocalChange(nextText) {
      if (currentRole === "viewer") {
        activeOptions?.onError?.("Viewers can follow live updates but cannot edit the document.");
        return false;
      }

      const currentText = ytext.toString();
      if (currentText === nextText) {
        return true;
      }

      const { prefixLength, deleteLength, insertText } = diffText(currentText, nextText);
      ydoc.transact(() => {
        if (deleteLength > 0) {
          ytext.delete(prefixLength, deleteLength);
        }
        if (insertText.length > 0) {
          ytext.insert(prefixLength, insertText);
        }
      }, LOCAL_TEXT_ORIGIN);

      return true;
    },
    replaceSelection(selection, replacement) {
      if (currentRole === "viewer") {
        activeOptions?.onError?.("Viewers cannot apply AI changes to the document.");
        return false;
      }

      const length = Math.max(0, selection.end - selection.start);
      ydoc.transact(() => {
        if (length > 0) {
          ytext.delete(selection.start, length);
        }
        if (replacement.length > 0) {
          ytext.insert(selection.start, replacement);
        }
      }, LOCAL_TEXT_ORIGIN);

      const nextSelection = {
        start: selection.start + replacement.length,
        end: selection.start + replacement.length,
      };
      updateLocalAwareness(nextSelection);
      return true;
    },
    setCursorSelection(selection) {
      updateLocalAwareness(selection);
    },
    sendPresence(payload) {
      const nextSelection = payload.selection ?? (typeof payload.cursor === "number"
        ? { start: payload.cursor, end: payload.cursor }
        : null);
      updateLocalAwareness(nextSelection);
    },
    applyRemoteReset(content) {
      resetDocumentContent(content, LOCAL_RESET_ORIGIN);
    },
    disconnect,
  };
}
