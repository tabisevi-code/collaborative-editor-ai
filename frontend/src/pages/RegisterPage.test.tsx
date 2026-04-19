import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthContext";
import { RegisterPage } from "./RegisterPage";

function createAuthAdapterMock() {
  return {
    setSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(async ({ identifier, displayName }: { identifier: string; displayName: string }) => ({
      user: {
        id: identifier,
        displayName,
      },
      accessToken: `token_${identifier}`,
      refreshToken: `refresh_${identifier}`,
      expiresAt: "2026-04-30T00:00:00.000Z",
    })),
    refresh: vi.fn(async () => {
      throw new Error("refresh should not be called in this test");
    }),
    logout: vi.fn(async () => {}),
  };
}

function renderRegisterPage(adapter = createAuthAdapterMock(), initialEntry = "/register") {
  render(
    <AuthProvider adapter={adapter}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>Dashboard Route</div>} />
          <Route path="/share/:shareToken" element={<div>Share Route</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

  return adapter;
}

describe("RegisterPage", () => {
  it("validates password confirmation before calling register", async () => {
    const adapter = renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Ming Ming" } });
    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_4" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "abc123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "xyz999" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(adapter.register).not.toHaveBeenCalled();
  });

  it("registers a user and redirects to the dashboard", async () => {
    const adapter = renderRegisterPage();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Ming Ming" } });
    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_4" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "abc123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(adapter.register).toHaveBeenCalledWith({
        displayName: "Ming Ming",
        identifier: "user_4",
        password: "abc123",
      });
      expect(screen.getByText("Dashboard Route")).toBeInTheDocument();
    });
  });

  it("respects the next route when registering from a share link", async () => {
    const adapter = renderRegisterPage(createAuthAdapterMock(), "/register?next=%2Fshare%2Ftoken_123");

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Ming Ming" } });
    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_4" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "abc123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(adapter.register).toHaveBeenCalled();
      expect(screen.getByText("Share Route")).toBeInTheDocument();
    });
  });
});
