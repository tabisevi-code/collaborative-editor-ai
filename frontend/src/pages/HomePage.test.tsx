import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ApiClient } from "../services/api";
import { HomePage } from "./HomePage";

function renderHomePage(apiClient: ApiClient) {
  return render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<HomePage apiClient={apiClient} userId="user_1" />} />
        <Route path="/documents/:documentId" element={<div>Document Route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("navigates to the document route after a successful create", async () => {
    const apiClient: ApiClient = {
      createDocument: vi.fn(async () => ({
        documentId: "doc_created",
        title: "My Doc",
        ownerId: "user_1",
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
        currentVersionId: "ver_1",
      })),
      getDocument: vi.fn(),
    };

    renderHomePage(apiClient);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My Doc" } });
    fireEvent.change(screen.getByLabelText("Initial Content"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Document" }));

    await waitFor(() => {
      expect(screen.getByText("Document Route")).toBeInTheDocument();
    });
  });

  it("navigates to the open document route when a document id is submitted", async () => {
    const apiClient: ApiClient = {
      createDocument: vi.fn(),
      getDocument: vi.fn(),
    };

    renderHomePage(apiClient);

    fireEvent.change(screen.getByLabelText("Document ID"), { target: { value: "doc_123" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Document" }));

    await waitFor(() => {
      expect(screen.getByText("Document Route")).toBeInTheDocument();
    });
  });
});
