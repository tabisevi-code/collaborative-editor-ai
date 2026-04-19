import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as encoding from "lib0/encoding";

import { createRealtimeService } from "./realtime";
import type { ApiClient } from "./api";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

function createApiClientMock(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    login: vi.fn(),
    createDocument: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    listVersions: vi.fn(),
    listPermissions: vi.fn(),
    updatePermission: vi.fn(),
    revokePermission: vi.fn(),
    getAiPolicy: vi.fn(),
    updateAiPolicy: vi.fn(),
    revertToVersion: vi.fn(),
    requestRewriteJob: vi.fn(),
    requestSummarizeJob: vi.fn(),
    requestTranslateJob: vi.fn(),
    startAiStream: vi.fn(),
    getAiJobStatus: vi.fn(),
    listAiHistory: vi.fn(),
    getAiUsage: vi.fn(),
    cancelAiJob: vi.fn(),
    recordAiJobFeedback: vi.fn(),
    createExport: vi.fn(),
    getExportJobStatus: vi.fn(),
    downloadExport: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  };
}

function encodeSyncUpdate(update: Uint8Array) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function createRemoteUpdate(text: string) {
  const remoteDoc = new Y.Doc();
  remoteDoc.getText("content").insert(0, text);
  return Y.encodeStateAsUpdate(remoteDoc);
}

function createAwarenessFrame(clientId: number, payload: Record<string, unknown>) {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.clientID = clientId;
  awareness.setLocalState(payload);

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, [clientId]));
  return encoding.toUint8Array(encoder);
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  binaryType = "blob";
  url: string;
  sent: Array<string | Uint8Array> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string | Uint8Array) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("realtime service", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("creates a session and sends a Yjs sync step on open", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onState = vi.fn();
    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "Seed text",
      onConnectionStateChange: onState,
    });

    expect(apiClient.createSession).toHaveBeenCalledWith("doc_123", "user_1");
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();

    expect(socket.sent.some((payload) => payload instanceof Uint8Array)).toBe(true);
    expect(onState).toHaveBeenCalledWith("connecting");
  });

  it("applies remote Yjs updates to the local shared text", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onTextChange = vi.fn();
    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "",
      onTextChange,
    });

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    const update = createRemoteUpdate("Remote text");
    socket.onmessage?.({
      data: encodeSyncUpdate(update).buffer,
    });

    expect(realtime.getText()).toBe("Remote text");
    expect(onTextChange).toHaveBeenCalledWith("Remote text");
  });

  it("emits remote awareness peers", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onPeersChange = vi.fn();
    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "",
      onPeersChange,
    });

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    socket.onmessage?.({
      data: createAwarenessFrame(77, {
        userId: "user_2",
        color: "#1a73e8",
        role: "editor",
        cursor: 4,
        selection: { start: 1, end: 4 },
      }).buffer,
    });

    expect(onPeersChange).toHaveBeenCalled();
  });

  it("ignores anonymous awareness states instead of rendering peer_<clientId> ghost users", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onPeersChange = vi.fn();
    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "",
      onPeersChange,
    });

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    socket.onmessage?.({
      data: createAwarenessFrame(77, {
        color: "#1a73e8",
        cursor: 4,
      }).buffer,
    });

    expect(onPeersChange).toHaveBeenCalledWith([]);
  });

  it("sends local text updates and blocks viewer edits", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onError = vi.fn();
    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "",
      onError,
    });

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    socket.onmessage?.({ data: encodeSyncUpdate(createRemoteUpdate("Base")).buffer });
    socket.sent = [];

    expect(realtime.applyLocalChange("Base plus")).toBe(true);
    expect(socket.sent.some((payload) => payload instanceof Uint8Array)).toBe(true);

    socket.onmessage?.({
      data: JSON.stringify({ type: "permission_updated", documentId: "doc_123", role: "viewer" }),
    });

    expect(realtime.applyLocalChange("blocked")).toBe(false);
    expect(onError).toHaveBeenCalledWith("Viewers can follow live updates but cannot edit the document.");
  });

  it("does not rebroadcast local reset operations back to the socket", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      role: "editor",
      initialContent: "",
    });

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    socket.sent = [];

    realtime.applyRemoteReset("Fresh body");

    expect(socket.sent).toEqual([]);
    expect(realtime.getText()).toBe("Fresh body");
  });
});
