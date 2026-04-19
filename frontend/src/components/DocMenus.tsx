/**
 * DocMenus — all eight menu-bar drop-downs for the document editor.
 *
 * Each exported component wraps <DropdownMenu> with a fixed list of items.
 * Actions that already exist on the toolbar (undo, redo, bold …) are wired
 * through callback props so the menus and toolbar stay in sync.
 */

import { DropdownMenu, type MenuEntry } from "./ui/DropdownMenu";
import type { ToolbarAction } from "../lib/richTextToolbar";

/* ── shared helpers ─────────────────────────────────────────────────── */

const SEP = { type: "separator" as const };

/* ═══════════════════════════════════════════════════════════════════════
   FILE
   ═══════════════════════════════════════════════════════════════════════ */

interface FileMenuProps {
  onSave?(): void;
  canSave?: boolean;
  onShare?(): void;
  onExport?(): void;
  onPrint?(): void;
}

export function FileMenu({ onSave, canSave = false, onShare, onExport, onPrint }: FileMenuProps) {
  const items: MenuEntry[] = [
    { label: "New", shortcut: "Ctrl+N", disabled: true },
    SEP,
    { label: "Save", shortcut: "Ctrl+S", onClick: onSave, disabled: !onSave || !canSave },
    ...(onShare ? [{ label: "Share", onClick: onShare }] : []),
    ...(onExport ? [{ label: "Export", onClick: onExport }] : []),
    SEP,
    { label: "Print", shortcut: "Ctrl+P", onClick: onPrint ?? (() => window.print()) },
  ];

  return (
    <DropdownMenu
      label="File"
      items={items}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT
   ═══════════════════════════════════════════════════════════════════════ */

interface EditMenuProps {
  onToolbarAction?(action: ToolbarAction): void;
  readOnly?: boolean;
}

export function EditMenu({ onToolbarAction, readOnly }: EditMenuProps) {
  const act = (a: ToolbarAction) => () => onToolbarAction?.(a);
  return (
    <DropdownMenu
      label="Edit"
      items={[
        { label: "Undo", shortcut: "Ctrl+Z", onClick: act("undo"), disabled: readOnly || !onToolbarAction },
        { label: "Redo", shortcut: "Ctrl+Y", onClick: act("redo"), disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "Cut", shortcut: "Ctrl+X", disabled: true },
        { label: "Copy", shortcut: "Ctrl+C", disabled: true },
        { label: "Paste", shortcut: "Ctrl+V", disabled: true },
        SEP,
        { label: "Select all", shortcut: "Ctrl+A", onClick: () => document.execCommand("selectAll") },
        { label: "Find and replace", shortcut: "Ctrl+H", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   VIEW
   ═══════════════════════════════════════════════════════════════════════ */

export function ViewMenu() {
  return (
    <DropdownMenu
      label="View"
      items={[
        { label: "100%", disabled: true },
        SEP,
        { label: "Print layout", disabled: true },
        { label: "Pageless layout", disabled: true },
        SEP,
        { label: "Full screen", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSERT
   ═══════════════════════════════════════════════════════════════════════ */

export function InsertMenu() {
  return (
    <DropdownMenu
      label="Insert"
      items={[
        { label: "Image", disabled: true },
        { label: "Link", shortcut: "Ctrl+K", disabled: true },
        SEP,
        { label: "Table", disabled: true },
        { label: "Horizontal line", disabled: true },
        SEP,
        { label: "Headers and footers", disabled: true },
        { label: "Footnote", disabled: true },
        SEP,
        { label: "Special characters", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FORMAT
   ═══════════════════════════════════════════════════════════════════════ */

interface FormatMenuProps {
  onToolbarAction?(action: ToolbarAction): void;
  readOnly?: boolean;
}

export function FormatMenu({ onToolbarAction, readOnly }: FormatMenuProps) {
  const act = (a: ToolbarAction) => () => onToolbarAction?.(a);
  return (
    <DropdownMenu
      label="Format"
      items={[
        { label: "Bold", shortcut: "Ctrl+B", onClick: act("bold"), disabled: readOnly || !onToolbarAction },
        { label: "Italic", shortcut: "Ctrl+I", onClick: act("italic"), disabled: readOnly || !onToolbarAction },
        { label: "Underline", shortcut: "Ctrl+U", onClick: act("underline"), disabled: readOnly || !onToolbarAction },
        { label: "Strikethrough", onClick: act("strike"), disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "Bulleted list", onClick: act("bulletList"), disabled: readOnly || !onToolbarAction },
        { label: "Numbered list", onClick: act("numberedList"), disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "Clear formatting", shortcut: "Ctrl+\\", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLS
   ═══════════════════════════════════════════════════════════════════════ */

interface ToolsMenuProps {
  onAiPolicyOpen?(): void;
}

export function ToolsMenu({ onAiPolicyOpen }: ToolsMenuProps) {
  const items: MenuEntry[] = [
    ...(onAiPolicyOpen
      ? [
          { label: "AI Policy", onClick: onAiPolicyOpen },
          SEP,
        ]
      : []),
    { label: "Spelling and grammar", disabled: true },
    { label: "Word count", disabled: true },
    SEP,
    { label: "Accessibility", disabled: true },
  ];

  return (
    <DropdownMenu
      label="Tools"
      items={items}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EXTENSIONS
   ═══════════════════════════════════════════════════════════════════════ */

export function ExtensionsMenu() {
  return (
    <DropdownMenu
      label="Extensions"
      items={[
        { label: "Manage extensions", disabled: true },
        SEP,
        { label: "Get add-ons", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELP
   ═══════════════════════════════════════════════════════════════════════ */

export function HelpMenu() {
  return (
    <DropdownMenu
      label="Help"
      items={[
        { label: "Keyboard shortcuts", shortcut: "Ctrl+/", disabled: true },
        SEP,
        { label: "About this editor", disabled: true },
        { label: "Send feedback", disabled: true },
      ]}
    />
  );
}
