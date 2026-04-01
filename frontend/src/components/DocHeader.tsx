import { Link } from "react-router-dom";
import type { GetDocumentResponse } from "../types/api";

type SaveState = "saved" | "unsaved" | "saving" | "error";

interface DocHeaderProps {
  document: GetDocumentResponse | null;
  draftTitle: string;
  canEditTitle?: boolean;
  onTitleChange(title: string): void;
  saveState: SaveState;
  userId: string;
  realtimeStatus?: string;
  onSave(): void;
  onAiOpen(): void;
  onHistoryOpen(): void;
  onPermissionsOpen?(): void;
  onAiPolicyOpen?(): void;
  onExportOpen?(): void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved:   "All changes saved",
  unsaved: "Unsaved changes",
  saving:  "Saving…",
  error:   "Save failed",
};

function DocsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40">
      <rect width="40" height="40" rx="4" fill="#4285f4"/>
      <rect x="9"  y="9"  width="22" height="28" rx="2" fill="white" opacity="0.9"/>
      <rect x="12" y="6"  width="13" height="4"  rx="1" fill="#a8c7fa"/>
      <path d="M25 6l6 6h-6V6z" fill="#4285f4"/>
      <rect x="13" y="16" width="14" height="1.5" rx="0.75" fill="#dadce0"/>
      <rect x="13" y="20" width="14" height="1.5" rx="0.75" fill="#dadce0"/>
      <rect x="13" y="24" width="9"  height="1.5" rx="0.75" fill="#dadce0"/>
    </svg>
  );
}

export function DocHeader({
  document,
  draftTitle,
  canEditTitle = false,
  onTitleChange,
  saveState,
  userId,
  realtimeStatus,
  onSave,
  onAiOpen,
  onHistoryOpen,
  onPermissionsOpen,
  onAiPolicyOpen,
  onExportOpen,
}: DocHeaderProps) {
  const role = document?.role ?? "viewer";
  const isReadOnly = role === "viewer";
  const isTitleReadOnly = isReadOnly || !canEditTitle;
  const initial = userId.charAt(0).toUpperCase() || "U";
  const canSave = !isReadOnly && (saveState === "unsaved" || saveState === "error");

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="gdoc-topbar">
        <Link to="/" className="gdoc-topbar-logo" title="Back to Docs home">
          <DocsIcon />
        </Link>

        <div className="gdoc-title-area">
          <input
            className="gdoc-title-input"
            value={draftTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            readOnly={isTitleReadOnly}
            aria-label="Document title"
            spellCheck={false}
          />
          <div className="gdoc-title-meta">
            <span className={`gdoc-save-chip ${saveState}`}>
              {saveState === "saving" && (
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "gd-spin 700ms linear infinite" }}>
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="18" strokeDashoffset="6" />
                </svg>
              )}
              {SAVE_LABEL[saveState]}
            </span>
            <span>·</span>
            <span className={`role-pill role-pill-${role}`}>{role}</span>
            {realtimeStatus && (
              <>
                <span>·</span>
                <span>{realtimeStatus}</span>
              </>
            )}
          </div>
        </div>

        <div className="gdoc-topbar-right">
          {onPermissionsOpen && role === "owner" && (
            <button className="btn btn-sm btn-secondary" onClick={onPermissionsOpen} title="Manage sharing">
              Share
            </button>
          )}
          {onAiPolicyOpen && role === "owner" && (
            <button className="btn btn-sm btn-secondary" onClick={onAiPolicyOpen} title="Manage AI policy">
              AI Policy
            </button>
          )}
          {onExportOpen && (
            <button className="btn btn-sm btn-secondary" onClick={onExportOpen} title="Export document">
              Export
            </button>
          )}
          {!isReadOnly && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={onSave}
              disabled={!canSave}
              title="Save"
            >
              Save
            </button>
          )}
          <button
            className="btn btn-sm btn-ai"
            onClick={onAiOpen}
            disabled={isReadOnly}
            title={isReadOnly ? "AI unavailable in view-only mode" : "AI Assistant"}
          >
            ✨ AI
          </button>
          <button className="gd-icon-btn" onClick={onHistoryOpen} title="Version history">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <div className="gdoc-user-avatar" title={`Signed in as ${userId}`}>{initial}</div>
        </div>
      </header>

      {/* ── Menu bar ────────────────────────────────────────────────── */}
      <nav className="gdoc-menubar" aria-label="Document menu">
        {["File", "Edit", "View", "Insert", "Format", "Tools", "Extensions", "Help"].map((item) => (
          <button key={item} className="gdoc-menu-item" title={`${item} (not yet implemented)`}>
            {item}
          </button>
        ))}
      </nav>

      {/* ── Format toolbar ──────────────────────────────────────────── */}
      <div className="gdoc-toolbar" role="toolbar" aria-label="Formatting">
        {/* Undo / Redo / Print */}
        <button className="gdoc-tb-btn" title="Undo (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>
        <button className="gdoc-tb-btn" title="Redo (Ctrl+Y)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        </button>
        <button className="gdoc-tb-btn" title="Print (Ctrl+P)" onClick={() => window.print()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
        </button>

        <div className="gdoc-toolbar-sep" />

        <select className="gdoc-tb-select" defaultValue="100" title="Zoom" style={{ width: 68 }}>
          {["50", "75", "90", "100", "125", "150", "200"].map((v) => (
            <option key={v} value={v}>{v}%</option>
          ))}
        </select>

        <div className="gdoc-toolbar-sep" />

        <select className="gdoc-tb-select" defaultValue="normal" title="Paragraph style" style={{ width: 120 }}>
          {["Normal text", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="gdoc-toolbar-sep" />

        <select className="gdoc-tb-select" defaultValue="Arial" title="Font" style={{ width: 100 }}>
          {["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>

        <button className="gdoc-tb-btn" disabled style={{ fontSize: 11 }} title="Decrease font size">−</button>
        <select className="gdoc-tb-select" defaultValue="11" title="Font size" style={{ width: 52 }}>
          {[8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 72].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="gdoc-tb-btn" disabled style={{ fontSize: 11 }} title="Increase font size">+</button>

        <div className="gdoc-toolbar-sep" />

        <button className="gdoc-tb-btn" disabled title="Bold" style={{ fontWeight: 700 }}>B</button>
        <button className="gdoc-tb-btn" disabled title="Italic" style={{ fontStyle: "italic" }}>I</button>
        <button className="gdoc-tb-btn" disabled title="Underline" style={{ textDecoration: "underline" }}>U</button>
        <button className="gdoc-tb-btn" disabled title="Strikethrough" style={{ textDecoration: "line-through", fontSize: 12 }}>S</button>

        <div className="gdoc-toolbar-sep" />

        {[
          { title: "Align left",   d: "M3 6h18M3 12h12M3 18h18" },
          { title: "Align center", d: "M3 6h18M6 12h12M3 18h18" },
          { title: "Align right",  d: "M3 6h18M9 12h12M3 18h18" },
          { title: "Justify",      d: "M3 6h18M3 12h18M3 18h18" },
        ].map(({ title, d }) => (
          <button key={title} className="gdoc-tb-btn" disabled title={title}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={d} />
            </svg>
          </button>
        ))}

        <div className="gdoc-toolbar-sep" />

        <button className="gdoc-tb-btn" disabled title="Bulleted list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button className="gdoc-tb-btn" disabled title="Numbered list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4M4 10h2M4 14a1 1 0 011-1h1a1 1 0 010 2H4.5a1 1 0 000 2H6" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="gdoc-toolbar-sep" />

        <button className="gdoc-tb-btn" disabled title="Insert link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        <button className="gdoc-tb-btn" disabled title="Insert image">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button className="gdoc-tb-btn" disabled title="Add comment">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>
    </>
  );
}
