import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import type { DashboardService } from "../services/dashboard";
import { HomePage } from "./HomePage";

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
    getAiJobStatus: vi.fn(),
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
    listDocuments: vi.fn(async () => ({
      owned: [],
      shared: [],
    })),
    rememberCreatedDocument: vi.fn(async () => {}),
    rememberDocument: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderHomePage(apiClient: ApiClient, dashboardService: DashboardService) {
  return render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              apiClient={apiClient}
              dashboardService={dashboardService}
              userId="user_1"
              displayName="User One"
            />
          }
        />
        <Route path="/documents/:documentId" element={<div>Document Route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("renders owned and shared dashboard sections from the adapter", async () => {
    const apiClient = createApiClientMock();
    const dashboardService = createDashboardServiceMock({
      listDocuments: vi.fn(async () => ({
        owned: [
          {
            documentId: "doc_owned",
            title: "Owned Doc",
            role: "owner",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
        ],
        shared: [
          {
            documentId: "doc_shared",
            title: "Shared Doc",
            role: "editor",
            updatedAt: "2026-04-02T00:10:00.000Z",
          },
        ],
      })),
    });

    renderHomePage(apiClient, dashboardService);

    expect(await screen.findByText("Owned by you")).toBeInTheDocument();
    expect(screen.getByText("Shared with you")).toBeInTheDocument();
    expect(screen.getByText("Owned Doc")).toBeInTheDocument();
    expect(screen.getByText("Shared Doc")).toBeInTheDocument();
  });

  it("navigates to the document route after a successful create", async () => {
    const apiClient = createApiClientMock({
      createDocument: vi.fn(async () => ({
        documentId: "doc_created",
        title: "My Doc",
        ownerId: "user_1",
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
        currentVersionId: "ver_1",
      })),
    });
    const dashboardService = createDashboardServiceMock();

    renderHomePage(apiClient, dashboardService);

    fireEvent.click(screen.getByText("Blank"));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "My Doc" } });
    fireEvent.change(screen.getByLabelText(/Initial content/i), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      expect(dashboardService.rememberCreatedDocument).toHaveBeenCalledWith(
        "user_1",
        expect.objectContaining({ documentId: "doc_created" })
      );
      expect(screen.getByText("Document Route")).toBeInTheDocument();
    });
  });

  it("navigates to the open document route when a document id is submitted", async () => {
    const apiClient = createApiClientMock();
    const dashboardService = createDashboardServiceMock();

    renderHomePage(apiClient, dashboardService);

    fireEvent.change(screen.getByLabelText("Document ID"), { target: { value: "doc_123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Open$/i }));

    await waitFor(() => {
      expect(screen.getByText("Document Route")).toBeInTheDocument();
    });
  });
});
