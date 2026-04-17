import { render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";

describe("App routing", () => {
  it("redirects protected routes to login when no session exists", async () => {
    window.history.pushState({}, "", "/documents/doc_123");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByLabelText(/identifier/i)).toBeInTheDocument();
    });
  });
});
