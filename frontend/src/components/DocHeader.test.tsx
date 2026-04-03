import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { GetDocumentResponse } from "../types/api";
import { DocHeader } from "./DocHeader";

function createDocument(role: GetDocumentResponse["role"] = "owner"): GetDocumentResponse {
  return {
    documentId: "doc_123",
    title: "Letter",
    content: "Hello world",
    updatedAt: "2026-04-02T00:00:00.000Z",
    currentVersionId: "ver_1",
    role,
    revisionId: "rev_1",
  };
}

function renderHeader({
  role = "owner",
  saveState = "unsaved",
}: {
  role?: GetDocumentResponse["role"];
  saveState?: "saved" | "unsaved" | "saving" | "error";
} = {}) {
  const onTitleChange = vi.fn();
  const onUserIdChange = vi.fn();
  const onSignOut = vi.fn();
  const onSave = vi.fn();
  const onAiOpen = vi.fn();
  const onHistoryOpen = vi.fn();
  const onPermissionsOpen = vi.fn();
  const onAiPolicyOpen = vi.fn();
  const onExportOpen = vi.fn();
  const onToolbarAction = vi.fn();

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DocHeader
        document={createDocument(role)}
        draftTitle="Letter"
        onTitleChange={onTitleChange}
        saveState={saveState}
        userId="user_1"
        onUserIdChange={onUserIdChange}
        onSignOut={onSignOut}
        realtimeStatus="Live sync connected"
        onSave={onSave}
        onAiOpen={onAiOpen}
        onHistoryOpen={onHistoryOpen}
        onPermissionsOpen={onPermissionsOpen}
        onAiPolicyOpen={onAiPolicyOpen}
        onExportOpen={onExportOpen}
        onToolbarAction={onToolbarAction}
      />
    </MemoryRouter>
  );

  return {
    onTitleChange,
    onUserIdChange,
    onSignOut,
    onSave,
    onAiOpen,
    onHistoryOpen,
    onPermissionsOpen,
    onAiPolicyOpen,
    onExportOpen,
    onToolbarAction,
  };
}

describe("DocHeader", () => {
  it("keeps file-level actions out of the top-right bar", () => {
    renderHeader({ role: "owner", saveState: "unsaved" });

    const banner = screen.getByRole("banner");

    expect(within(banner).queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(within(banner).queryByRole("button", { name: "AI Policy" })).not.toBeInTheDocument();
    expect(within(banner).queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(within(banner).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(banner).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    expect(within(banner).getByRole("button", { name: /ai/i })).toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: "Version history" })).toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: "Open user menu" })).toBeInTheDocument();
  });

  it("shows owner-only actions in File and Tools menus", () => {
    const handlers = renderHeader({ role: "owner", saveState: "unsaved" });

    fireEvent.click(screen.getByRole("button", { name: "File" }));

    const saveItem = screen.getByRole("menuitem", { name: /save/i });
    const shareItem = screen.getByRole("menuitem", { name: "Share" });
    const exportItem = screen.getByRole("menuitem", { name: "Export" });

    expect(saveItem).toBeEnabled();
    expect(shareItem).toBeEnabled();
    expect(exportItem).toBeEnabled();

    fireEvent.click(saveItem);
    expect(handlers.onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(handlers.onPermissionsOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    const aiPolicyItem = screen.getByRole("menuitem", { name: "AI Policy" });
    fireEvent.click(aiPolicyItem);
    expect(handlers.onAiPolicyOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps owner-only menu actions hidden for editors and disables save for viewers", () => {
    renderHeader({ role: "editor", saveState: "saved" });

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect(screen.queryByRole("menuitem", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /save/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    expect(screen.queryByRole("menuitem", { name: "AI Policy" })).not.toBeInTheDocument();
  });

  it("lets the user dropdown edit the active user id and trigger sign out", () => {
    const handlers = renderHeader({ role: "owner", saveState: "saved" });

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));

    const dialog = screen.getByRole("dialog", { name: "User menu" });
    const input = within(dialog).getByRole("textbox", { name: "Active user ID" });
    fireEvent.change(input, { target: { value: "user_7" } });
    expect(handlers.onUserIdChange).toHaveBeenCalledWith("user_7");

    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(handlers.onSignOut).toHaveBeenCalledTimes(1);
  });
});
