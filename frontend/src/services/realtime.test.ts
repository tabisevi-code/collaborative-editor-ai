import { createRealtimeService } from "./realtime";
import type { ApiClient } from "./api";

function createApiClientMock(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
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
    getAiJobStatus: vi.fn(),
    createExport: vi.fn(),
    getExportJobStatus: vi.fn(),
    downloadExport: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  };
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string) {
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

  it("creates a session, connects a socket, and forwards presence messages", async () => {
    const apiClient = createApiClientMock({
      createSession: vi.fn(async () => ({
        sessionId: "sess_123",
        wsUrl: "ws://localhost:3001/ws?token=abc",
        role: "editor",
      })),
    });

    const onSessionReady = vi.fn();
    const onPresenceJoin = vi.fn();

    const realtime = createRealtimeService(apiClient);
    await realtime.connect("doc_123", {
      userId: "user_1",
      onSessionReady,
      onPresenceJoin,
    });

    expect(apiClient.createSession).toHaveBeenCalledWith("doc_123", "user_1");
    expect(MockWebSocket.instances).toHaveLength(1);

    const socket = MockWebSocket.instances[0];
    socket.onmessage?.({
      data: JSON.stringify({
        type: "session_ready",
        sessionId: "sess_123",
        documentId: "doc_123",
        userId: "user_1",
        role: "editor",
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        type: "presence_join",
        documentId: "doc_123",
        userId: "user_2",
      }),
    });

    realtime.sendPresence({
      cursor: 5,
      selection: { start: 1, end: 5 },
    });

    expect(onSessionReady).toHaveBeenCalled();
    expect(onPresenceJoin).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc_123",
        userId: "user_2",
      })
    );
    expect(socket.sent).toContain(
      JSON.stringify({
        type: "presence",
        cursor: 5,
        selection: { start: 1, end: 5 },
      })
    );
  });
});
