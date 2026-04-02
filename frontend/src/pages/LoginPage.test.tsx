import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ApiClient } from "../services/api";
import { LoginPage } from "./LoginPage";

function createApiClientMock(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    login: vi.fn(async (userId: string) => ({
      userId,
      displayName: userId,
      globalRole: "user",
      accessToken: `token_${userId}`,
      expiresIn: 86400,
    })),
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

describe("LoginPage", () => {
  it("authenticates the entered user id and calls onAuthenticated", async () => {
    const apiClient = createApiClientMock();
    const onAuthenticated = vi.fn();

    render(<LoginPage apiClient={apiClient} onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: "user_2" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith("user_2");
      expect(onAuthenticated).toHaveBeenCalledWith("user_2");
    });
  });
});
