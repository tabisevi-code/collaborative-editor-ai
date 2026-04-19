import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ApiClient } from "../services/api";
import { AiPolicyPanel } from "./AiPolicyPanel";
import { ExportPanel } from "./ExportPanel";
import { PermissionsPanel } from "./PermissionsPanel";
import { VersionHistoryPanel } from "./VersionHistoryPanel";

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
    getAiUsage: vi.fn(),
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

describe("management panels", () => {
  it("loads and updates permissions", async () => {
    const apiClient = createApiClientMock({
      listPermissions: vi.fn(async () => ({
        documentId: "doc_123",
        members: [{ userId: "user_1", role: "owner", updatedAt: "2026-04-02T00:00:00.000Z" }],
      })),
      listShareLinks: vi.fn(async () => ({
        documentId: "doc_123",
        links: [],
      })),
      updatePermission: vi.fn(async () => ({
        documentId: "doc_123",
        targetUserId: "user_2",
        role: "editor",
        updatedAt: "2026-04-02T00:00:00.000Z",
      })),
    });

    render(
      <PermissionsPanel documentId="doc_123" userId="user_1" apiClient={apiClient} onClose={vi.fn()} />
    );

    await screen.findByText("user_1");
    fireEvent.change(screen.getByLabelText(/collaborator user id/i), { target: { value: "user_2" } });
    fireEvent.click(screen.getByText(/grant access/i));

    await waitFor(() => {
      expect(apiClient.updatePermission).toHaveBeenCalled();
    });
  });

  it("creates a share link and surfaces the generated URL", async () => {
    const apiClient = createApiClientMock({
      listPermissions: vi.fn(async () => ({
        documentId: "doc_123",
        members: [{ userId: "user_1", role: "owner", updatedAt: "2026-04-02T00:00:00.000Z" }],
      })),
      listShareLinks: vi.fn(async () => ({
        documentId: "doc_123",
        links: [],
      })),
      createShareLink: vi.fn(async () => ({
        linkId: "link_123",
        role: "viewer",
        createdAt: "2026-04-02T00:00:00.000Z",
        expiresAt: "2026-04-03T00:00:00.000Z",
        revokedAt: null,
        lastClaimedAt: null,
        active: true,
        shareToken: "share_token_123",
      })),
    });

    render(
      <PermissionsPanel documentId="doc_123" userId="user_1" apiClient={apiClient} onClose={vi.fn()} />
    );

    await screen.findByText("Invite links");
    fireEvent.click(screen.getByRole("button", { name: /create share link/i }));

    await waitFor(() => {
      expect(apiClient.createShareLink).toHaveBeenCalledWith(
        "doc_123",
        expect.objectContaining({ role: "viewer", expiresInHours: 168, requestId: expect.any(String) }),
        "user_1"
      );
      expect(screen.getByText(/share_token_123/i)).toBeInTheDocument();
    });
  });

  it("loads and saves AI policy", async () => {
    const apiClient = createApiClientMock({
      getAiPolicy: vi.fn(async () => ({
        documentId: "doc_123",
        aiEnabled: true,
        allowedRolesForAI: ["owner", "editor"],
        dailyQuota: 5,
        usedToday: 2,
        remainingToday: 3,
        updatedAt: "2026-04-02T00:00:00.000Z",
      })),
      updateAiPolicy: vi.fn(async (documentId, payload) => ({
        documentId,
        ...payload,
        updatedAt: "2026-04-02T00:01:00.000Z",
      })),
    });

    render(<AiPolicyPanel documentId="doc_123" userId="user_1" apiClient={apiClient} onClose={vi.fn()} />);

    await screen.findByDisplayValue("5");
    fireEvent.click(screen.getByText("viewer"));
    fireEvent.change(screen.getByLabelText(/daily quota/i), { target: { value: "9" } });
    fireEvent.click(screen.getByText(/save policy/i));

    await waitFor(() => {
      expect(apiClient.updateAiPolicy).toHaveBeenCalledWith(
        "doc_123",
        expect.objectContaining({
          dailyQuota: 9,
          allowedRolesForAI: ["owner", "editor", "viewer"],
        }),
        "user_1"
      );
      expect(screen.getByText(/ai policy saved/i)).toBeInTheDocument();
    });
  });

  it("handles async export jobs and downloads the finished file", async () => {
    const createObjectUrl = vi.fn(() => "blob:download");
    const revokeObjectUrl = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    Object.defineProperty(window.URL, "createObjectURL", {
      writable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      writable: true,
      value: revokeObjectUrl,
    });

    const apiClient = createApiClientMock({
      createExport: vi.fn(async () => ({
        jobId: "expjob_123",
        statusUrl: "/exports/expjob_123",
      })),
      getExportJobStatus: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: "expjob_123",
          status: "RUNNING",
          downloadUrl: null,
          expiresAt: null,
        })
        .mockResolvedValueOnce({
          jobId: "expjob_123",
          status: "SUCCEEDED",
          downloadUrl: "/exports/expjob_123/download",
          expiresAt: "2026-04-02T00:30:00.000Z",
        }),
      downloadExport: vi.fn(async () => ({
        blob: new Blob(["hello"], { type: "application/pdf" }),
        fileName: "doc_123.pdf",
        contentType: "application/pdf",
      })),
    });

    render(<ExportPanel documentId="doc_123" userId="user_1" apiClient={apiClient} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/file format/i), { target: { value: "pdf" } });
    fireEvent.click(screen.getByText(/start export/i));

    await screen.findByText(/export ready/i);
    fireEvent.click(screen.getByText(/download export/i));

    await waitFor(() => {
      expect(apiClient.downloadExport).toHaveBeenCalledWith("expjob_123", "user_1");
      expect(createObjectUrl).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });

  it("shows a preview for the selected version", async () => {
    const apiClient = createApiClientMock({
      listVersions: vi.fn(async () => ({
        documentId: "doc_123",
        versions: [
          {
            versionId: "ver_2",
            versionNumber: 2,
            createdAt: "2026-04-02T00:05:00.000Z",
            createdBy: "user_1",
            reason: "content_update",
            snapshotContent: "<p>Updated snapshot</p>",
          },
          {
            versionId: "ver_1",
            versionNumber: 1,
            createdAt: "2026-04-02T00:00:00.000Z",
            createdBy: "user_1",
            reason: "initial_create",
            snapshotContent: "<p>Original snapshot</p>",
          },
        ],
      })),
    });

    render(
      <VersionHistoryPanel
        documentId="doc_123"
        userId="user_1"
        apiClient={apiClient}
        canRevert
        onRevert={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/Preview Version 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Updated snapshot/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Version 1/i));

    await waitFor(() => {
      expect(screen.getByText(/Preview Version 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Original snapshot/i)).toBeInTheDocument();
    });
  });
});
