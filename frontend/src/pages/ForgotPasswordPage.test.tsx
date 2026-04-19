import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

function createApiClientMock(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    setSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(async () => ({
      accepted: true,
      message: "Reset token issued.",
      resetToken: "reset-token-123",
      expiresAt: "2026-04-30T00:00:00.000Z",
    })),
    resetPassword: vi.fn(async () => ({ reset: true })),
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

function renderForgotPasswordPage(apiClient = createApiClientMock()) {
  render(
    <MemoryRouter initialEntries={["/forgot-password"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage apiClient={apiClient} />} />
        <Route path="/login" element={<div>Login Route</div>} />
      </Routes>
    </MemoryRouter>
  );

  return apiClient;
}

describe("ForgotPasswordPage", () => {
  it("requests a reset token and submits a new password", async () => {
    const apiClient = renderForgotPasswordPage();

    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_1" } });
    fireEvent.click(screen.getByRole("button", { name: /get reset token/i }));

    await waitFor(() => {
      expect(apiClient.forgotPassword).toHaveBeenCalledWith({ identifier: "user_1" });
      expect(screen.getByLabelText(/reset token/i)).toHaveValue("reset-token-123");
    });

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "new-pass-123" } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: "new-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(apiClient.resetPassword).toHaveBeenCalledWith({
        identifier: "user_1",
        resetToken: "reset-token-123",
        newPassword: "new-pass-123",
      });
    });
  });
});
