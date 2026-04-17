import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../auth/AuthContext";
import { LoginPage } from "./LoginPage";

function createAuthAdapterMock() {
  return {
    login: vi.fn(async ({ identifier }: { identifier: string }) => ({
      user: {
        id: identifier,
        displayName: identifier,
      },
      accessToken: `token_${identifier}`,
      refreshToken: `refresh_${identifier}`,
      expiresAt: "2026-04-30T00:00:00.000Z",
    })),
    register: vi.fn(),
    refresh: vi.fn(async () => {
      throw new Error("refresh should not be called in this test");
    }),
  };
}

function renderLoginPage(adapter = createAuthAdapterMock()) {
  render(
    <AuthProvider adapter={adapter}>
      <MemoryRouter initialEntries={["/login"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

  return adapter;
}

describe("LoginPage", () => {
  it("submits identifier and password through the auth provider", async () => {
    const adapter = renderLoginPage();

    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_2" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(adapter.login).toHaveBeenCalledWith({
        identifier: "user_2",
        password: "secret-pass",
      });
      expect(screen.getByText("Dashboard Route")).toBeInTheDocument();
    });
  });

  it("shows backend-facing errors from the auth adapter", async () => {
    const adapter = createAuthAdapterMock();
    adapter.login.mockRejectedValueOnce(new Error("broken"));
    renderLoginPage(adapter);

    fireEvent.change(screen.getByLabelText(/identifier/i), { target: { value: "user_2" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected authentication error/i)).toBeInTheDocument();
    });
  });
});
