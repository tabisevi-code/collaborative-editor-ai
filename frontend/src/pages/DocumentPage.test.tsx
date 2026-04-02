import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import { ApiError, type GetDocumentResponse } from "../types/api";
import { DocumentPage } from "./DocumentPage";

const mockRealtimeService = {
  connect: vi.fn(),
  getText: vi.fn(() => "Original body"),
  applyLocalChange: vi.fn(() => true),
  replaceSelection: vi.fn(() => true),
  setCursorSelection: vi.fn(),
  applyRemoteReset: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("../services/realtime", () => ({
  createRealtimeService: vi.fn(() => mockRealtimeService),
}));

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
    recordAiJobFeedback: vi.fn(),
    createExport: vi.fn(),
    getExportJobStatus: vi.fn(),
    downloadExport: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  };
}

function renderDocumentPage(apiClient: ApiClient, userId = "user_1") {
  return render(
    <MemoryRouter
      initialEntries={["/documents/doc_123"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<div>Home Route</div>} />
        <Route
          path="/documents/:documentId"
          element={<DocumentPage apiClient={apiClient} userId={userId} onUserIdChange={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

async function resolveRealtimeConnection(text = "Original body") {
  await waitFor(() => {
    expect(mockRealtimeService.connect).toHaveBeenCalled();
  });

  const call = mockRealtimeService.connect.mock.calls.at(-1);
  const options = call?.[1];
  await act(async () => {
    mockRealtimeService.getText.mockReturnValue(text);
    options?.onTextChange?.(text);
    options?.onConnectionStateChange?.("connected");
  });
  return options;
}

describe("DocumentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRealtimeService.getText.mockReturnValue("Original body");
  });

  it("renders viewer mode as read-only", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => ({
        documentId: "doc_123",
        title: "Shared Doc",
        content: "Read only text",
        updatedAt: "2026-04-02T00:00:00.000Z",
        currentVersionId: "ver_1",
        role: "viewer",
        revisionId: "rev_1",
      }) satisfies GetDocumentResponse),
    });

    renderDocumentPage(apiClient, "user_2");
    await resolveRealtimeConnection("Read only text");

    await waitFor(() => {
      expect(screen.getByText(/viewer access/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Document content")).toHaveAttribute("readonly");
  });

  it("renders remote collaborative text updates without refreshing", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => ({
        documentId: "doc_123",
        title: "Realtime Doc",
        content: "Original body",
        updatedAt: "2026-04-02T00:00:00.000Z",
        currentVersionId: "ver_1",
        role: "editor",
        revisionId: "rev_1",
      }) satisfies GetDocumentResponse),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await screen.findByDisplayValue("Original body");

    await act(async () => {
      options?.onTextChange?.("Remote collaborator update");
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Remote collaborator update")).toBeInTheDocument();
    });
  });

  it("saves the current collaborative snapshot instead of the initial REST body", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi
        .fn()
        .mockResolvedValue({
          documentId: "doc_123",
          title: "Realtime Doc",
          content: "Original body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "editor",
          revisionId: "rev_1",
        } satisfies GetDocumentResponse),
      updateDocument: vi.fn(async () => ({
        documentId: "doc_123",
        updatedAt: "2026-04-02T00:05:00.000Z",
        revisionId: "rev_2",
      })),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await screen.findByDisplayValue("Original body");
    await act(async () => {
      options?.onTextChange?.("Collaborative draft");
    });
    mockRealtimeService.getText.mockReturnValue("Collaborative draft");

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(apiClient.updateDocument).toHaveBeenCalledWith(
        "doc_123",
        expect.objectContaining({
          content: "Collaborative draft",
          baseRevisionId: "rev_1",
        }),
        "user_1"
      );
    });
  });

  it("redirects stale document URLs back home after a 404 load error", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => {
        throw new ApiError(404, "NOT_FOUND", "document not found");
      }),
    });

    renderDocumentPage(apiClient);

    await waitFor(() => {
      expect(screen.getByText(/returning to the home page/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/go back home now/i));

    await waitFor(() => {
      expect(screen.getByText("Home Route")).toBeInTheDocument();
    });
  });

  it("shows a reload action for stale save conflicts", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi
        .fn()
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Conflict Doc",
          content: "Original body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "editor",
          revisionId: "rev_1",
        } satisfies GetDocumentResponse)
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Conflict Doc",
          content: "Fresh body",
          updatedAt: "2026-04-02T00:05:00.000Z",
          currentVersionId: "ver_2",
          role: "editor",
          revisionId: "rev_2",
        } satisfies GetDocumentResponse),
      updateDocument: vi.fn(async () => {
        throw new ApiError(409, "CONFLICT", "base revision is stale", {
          expectedRevisionId: "rev_2",
          actualRevisionId: "rev_1",
        });
      }),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await screen.findByDisplayValue("Original body");
    await act(async () => {
      options?.onTextChange?.("Changed collaboratively");
    });
    mockRealtimeService.getText.mockReturnValue("Changed collaboratively");

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/reload latest saved version/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/reload latest saved version/i));

    await waitFor(() => {
      expect(mockRealtimeService.applyRemoteReset).toHaveBeenCalledWith("Fresh body");
    });
  });

  it("autosaves collaborative changes after a short debounce", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi
        .fn()
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Autosave Doc",
          content: "Original body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "editor",
          revisionId: "rev_1",
        } satisfies GetDocumentResponse)
        .mockResolvedValue({
          documentId: "doc_123",
          title: "Autosave Doc",
          content: "Autosaved draft",
          updatedAt: "2026-04-02T00:05:00.000Z",
          currentVersionId: "ver_2",
          role: "editor",
          revisionId: "rev_2",
        } satisfies GetDocumentResponse),
      updateDocument: vi.fn(async () => ({
        documentId: "doc_123",
        updatedAt: "2026-04-02T00:05:00.000Z",
        revisionId: "rev_2",
      })),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await screen.findByDisplayValue("Original body");
    await act(async () => {
      options?.onTextChange?.("Autosaved draft");
    });
    mockRealtimeService.getText.mockReturnValue("Autosaved draft");

    await waitFor(
      () => {
        expect(apiClient.updateDocument).toHaveBeenCalledWith(
          "doc_123",
          expect.objectContaining({
            content: "Autosaved draft",
            baseRevisionId: "rev_1",
          }),
          "user_1"
        );
      },
      { timeout: 2500 }
    );

    expect(mockRealtimeService.connect).toHaveBeenCalledTimes(1);
  });
});
