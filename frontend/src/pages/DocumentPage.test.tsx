import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import type { DashboardService } from "../services/dashboard";
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
    setSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    listDocuments: vi.fn(),
    createDocument: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    listVersions: vi.fn(),
    listPermissions: vi.fn(),
    updatePermission: vi.fn(),
    revokePermission: vi.fn(),
    listShareLinks: vi.fn(),
    createShareLink: vi.fn(),
    revokeShareLink: vi.fn(),
    previewShareLink: vi.fn(),
    acceptShareLink: vi.fn(),
    getAiPolicy: vi.fn(),
    getAiUsage: vi.fn(async () => ({
      documentId: "doc_123",
      aiEnabled: true,
      dailyQuota: 5,
      usedToday: 0,
      remainingToday: 5,
      allowedRolesForAI: ["owner", "editor"],
      currentUserRole: "owner",
      canUseAi: true,
    })),
    updateAiPolicy: vi.fn(),
    revertToVersion: vi.fn(),
    startAiStream: vi.fn(),
    listAiHistory: vi.fn(),
    cancelAiJob: vi.fn(),
    recordAiJobFeedback: vi.fn(),
    createExport: vi.fn(),
    getExportJobStatus: vi.fn(),
    downloadExport: vi.fn(),
    createSession: vi.fn(),
    ...overrides,
  };
}

function createDashboardServiceMock(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    listDocuments: vi.fn(async () => ({ owned: [], shared: [] })),
    rememberCreatedDocument: vi.fn(async () => {}),
    rememberDocument: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderDocumentPage(apiClient: ApiClient, dashboardService = createDashboardServiceMock(), userId = "user_1") {
  return render(
    <MemoryRouter
      initialEntries={["/documents/doc_123"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<div>Home Route</div>} />
        <Route
          path="/documents/:documentId"
          element={
            <DocumentPage
              apiClient={apiClient}
              dashboardService={dashboardService}
              userId={userId}
              displayName="User One"
              onSignOut={vi.fn()}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function getPageEditor(pageNumber = 1) {
  void pageNumber;
  return screen.getByLabelText(/Document content/i);
}

function clickFileMenuSave() {
  fireEvent.click(screen.getByRole("button", { name: "File" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /save/i }));
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

    renderDocumentPage(apiClient, createDashboardServiceMock(), "user_2");

    await waitFor(() => {
      expect(screen.getByText("View-only")).toBeInTheDocument();
    });

    expect(getPageEditor()).toHaveAttribute("contenteditable", "false");
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

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });

    await act(async () => {
      options?.onTextChange?.("Remote collaborator update");
    });

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Remote collaborator update");
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

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });
    await act(async () => {
      options?.onTextChange?.("Collaborative draft");
    });
    mockRealtimeService.getText.mockReturnValue("Collaborative draft");

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    clickFileMenuSave();

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
        } satisfies GetDocumentResponse)
        .mockResolvedValue({
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

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });
    await act(async () => {
      options?.onTextChange?.("Changed collaboratively");
    });
    mockRealtimeService.getText.mockReturnValue("Changed collaboratively");

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    clickFileMenuSave();

    await waitFor(() => {
      expect(screen.getByText(/reload latest saved version/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/reload latest saved version/i));

    await waitFor(() => {
      expect(mockRealtimeService.applyRemoteReset).toHaveBeenCalledWith("Fresh body");
    });
  });

  it("retries once with the latest revision during live collaboration before surfacing a stale conflict", async () => {
    const conflictError = new ApiError(409, "CONFLICT", "base revision is stale", {
      expectedRevisionId: "rev_2",
      actualRevisionId: "rev_1",
    });

    const apiClient = createApiClientMock({
      getDocument: vi
        .fn()
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Retry Doc",
          content: "Original body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "editor",
          revisionId: "rev_1",
        } satisfies GetDocumentResponse)
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Retry Doc",
          content: "Remote body",
          updatedAt: "2026-04-02T00:02:00.000Z",
          currentVersionId: "ver_2",
          role: "editor",
          revisionId: "rev_2",
        } satisfies GetDocumentResponse)
        .mockResolvedValue({
          documentId: "doc_123",
          title: "Retry Doc",
          content: "Merged body",
          updatedAt: "2026-04-02T00:03:00.000Z",
          currentVersionId: "ver_3",
          role: "editor",
          revisionId: "rev_3",
        } satisfies GetDocumentResponse),
      updateDocument: vi
        .fn()
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValueOnce({
          documentId: "doc_123",
          updatedAt: "2026-04-02T00:03:00.000Z",
          revisionId: "rev_3",
        }),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });

    await act(async () => {
      options?.onTextChange?.("Merged body");
    });
    mockRealtimeService.getText.mockReturnValue("Merged body");

    await waitFor(
      () => {
        expect(apiClient.updateDocument).toHaveBeenCalledTimes(2);
      },
      { timeout: 2500 }
    );

    expect(screen.queryByText(/reload latest saved version/i)).not.toBeInTheDocument();
  });

  it("refreshes metadata after a realtime revert without applying a second local CRDT reset", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi
        .fn()
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Revert Doc",
          content: "Original body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "owner",
          revisionId: "rev_1",
        } satisfies GetDocumentResponse)
        .mockResolvedValueOnce({
          documentId: "doc_123",
          title: "Revert Doc",
          content: "Reverted body",
          updatedAt: "2026-04-02T00:04:00.000Z",
          currentVersionId: "ver_3",
          role: "owner",
          revisionId: "rev_3",
        } satisfies GetDocumentResponse),
    });

    renderDocumentPage(apiClient);
    const options = await resolveRealtimeConnection("Original body");

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });

    await act(async () => {
      options?.onDocumentReverted?.({
        documentId: "doc_123",
        currentVersionId: "ver_3",
        revisionId: "rev_3",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/remote revert was applied/i)).toBeInTheDocument();
    });

    expect(mockRealtimeService.applyRemoteReset).not.toHaveBeenCalled();
    expect(mockRealtimeService.connect).toHaveBeenCalledTimes(2);
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

    await waitFor(() => {
      expect(getPageEditor()).toHaveTextContent("Original body");
    });
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
