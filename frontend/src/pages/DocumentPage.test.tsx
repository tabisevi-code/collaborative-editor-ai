import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import { ApiError, type GetDocumentResponse } from "../types/api";
import { DocumentPage } from "./DocumentPage";

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

function renderDocumentPage(apiClient: ApiClient, userId = "user_1") {
  return render(
    <MemoryRouter
      initialEntries={["/documents/doc_123"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/documents/:documentId" element={<DocumentPage apiClient={apiClient} userId={userId} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DocumentPage", () => {
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

    await waitFor(() => {
      expect(screen.getByText(/viewer access/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Document content")).toHaveAttribute("readonly");
  });

  it("shows an unsaved draft hint for editable roles", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => ({
        documentId: "doc_123",
        title: "Editable Doc",
        content: "Original body",
        updatedAt: "2026-04-02T00:00:00.000Z",
        currentVersionId: "ver_1",
        role: "owner",
        revisionId: "rev_1",
      }) satisfies GetDocumentResponse),
    });

    renderDocumentPage(apiClient);

    const editor = await screen.findByLabelText("Document content");
    fireEvent.change(editor, { target: { value: "Changed locally" } });

    await waitFor(() => {
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });
  });

  it("shows a document not found banner for 404 errors", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => {
        throw new ApiError(404, "NOT_FOUND", "document not found");
      }),
    });

    renderDocumentPage(apiClient);

    await waitFor(() => {
      expect(screen.getByText("Document not found.")).toBeInTheDocument();
    });
  });

  it("shows a backend unavailable banner for network failures", async () => {
    const apiClient = createApiClientMock({
      getDocument: vi.fn(async () => {
        throw new ApiError(0, "NETWORK_ERROR", "backend unavailable");
      }),
    });

    renderDocumentPage(apiClient);

    await waitFor(() => {
      expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();
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

    const editor = await screen.findByLabelText("Document content");
    fireEvent.change(editor, { target: { value: "Changed locally" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/reload latest version/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/reload latest version/i));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Fresh body")).toBeInTheDocument();
    });
  });
});
