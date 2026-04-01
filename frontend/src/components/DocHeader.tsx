import { Link } from "react-router-dom";
import type { GetDocumentResponse } from "../types/api";
import { type FormattingState, INITIAL_FORMATTING } from "./RichEditor";

type SaveState = "saved" | "unsaved" | "saving" | "error";

interface DocHeaderProps {
  document: GetDocumentResponse | null;
  draftTitle: string;
  onTitleChange(title: string): void;
  saveState: SaveState;
  userId: string;
  onSave(): void;
  onAiOpen(): void;
  onHistoryOpen(): void;
  /** Current formatting state from RichEditor — drives active/inactive toolbar buttons */
  formattingState?: FormattingState;
  /** Execute a rich-text command — all toolbar buttons call this */
  onFormat?: (command: string, value?: string) => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved:   "All changes saved",
  unsaved: "Unsaved changes",
  saving:  "Saving…",
  error:   "Save failed",
};

const FONT_SIZES = [
  { label: "8pt",  value: "1" },
  { label: "10pt", value: "2" },
  { label: "12pt", value: "3" },
  { label: "14pt", value: "4" },
  { label: "18pt", value: "5" },
  { label: "24pt", value: "6" },
  { label: "36pt", value: "7" },
];

const FONTS = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS"];

const PARA_STYLES = [
  { label: "Normal text", value: "p"   },
  { label: "Heading 1",   value: "h1"  },
  { label: "Heading 2",   value: "h2"  },
  { label: "Heading 3",   value: "h3"  },
  { label: "Title",       value: "h1"  },
];

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

/** Prevent toolbar clicks from stealing focus/selection from the editor */
function noFocusSteal(e: React.MouseEvent) {
  e.preventDefault();
}

export function DocHeader({
  document,
  draftTitle,
  onTitleChange,
  saveState,
  userId,
  onSave,
  onAiOpen,
  onHistoryOpen,
  formattingState = INITIAL_FORMATTING,
  onFormat,
}: DocHeaderProps) {
  const role       = document?.role ?? "viewer";
  const isReadOnly = role === "viewer";
  const initial    = userId.charAt(0).toUpperCase() || "U";
  const canSave    = !isReadOnly && (saveState === "unsaved" || saveState === "error");

  function fmt(command: string, value?: string) {
    onFormat?.(command, value);
  }

  function tb(
    title: string,
    command: string,
    content: React.ReactNode,
    value?: string,
    active?: boolean,
  ) {
    return (
      <button
        key={command + (value ?? "")}
        className={`gdoc-tb-btn${active ? " active" : ""}`}
        title={title}
        onMouseDown={noFocusSteal}
        onClick={() => fmt(command, value)}
        disabled={isReadOnly}
        aria-pressed={active}
      >
        {content}
      </button>
    );
  }

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
            readOnly={isReadOnly}
            aria-label="Document title"
            spellCheck={false}
          />
          <div className="gdoc-title-meta">
            <span className={`gdoc-save-chip ${saveState}`}>
              {saveState === "saving" && (
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "gd-spin 700ms linear infinite" }}>
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="18" strokeDashoffset="6"/>
                </svg>
              )}
              {SAVE_LABEL[saveState]}
            </span>
            <span>·</span>
            <span className={`role-pill role-pill-${role}`}>{role}</span>
          </div>
        </div>

        <div className="gdoc-topbar-right">
          {!isReadOnly && (
            <button className="btn btn-sm btn-ghost" onClick={onSave} disabled={!canSave}>
              Save
            </button>
          )}
          <button className="btn btn-sm btn-ai" onClick={onAiOpen} disabled={isReadOnly} title="AI Assistant (select text first)">
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
          <button key={item} className="gdoc-menu-item">{item}</button>
        ))}
      </nav>

      {/* ── Format toolbar ──────────────────────────────────────────── */}
      <div className="gdoc-toolbar" role="toolbar" aria-label="Formatting" onMouseDown={noFocusSteal}>

        {/* Undo / Redo / Print */}
        {tb("Undo (Ctrl+Z)", "undo",
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        )}
        {tb("Redo (Ctrl+Y)", "redo",
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        )}
        <button className="gdoc-tb-btn" title="Print (Ctrl+P)" onMouseDown={noFocusSteal} onClick={() => window.print()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
        </button>

        <div className="gdoc-toolbar-sep"/>

        {/* Zoom (display only) */}
        <select className="gdoc-tb-select" defaultValue="100" title="Zoom" style={{ width: 68 }} onMouseDown={noFocusSteal} onChange={() => {}}>
          {["50","75","90","100","125","150","200"].map((v) => (
            <option key={v} value={v}>{v}%</option>
          ))}
        </select>

        <div className="gdoc-toolbar-sep"/>

        {/* Paragraph style */}
        <select
          className="gdoc-tb-select"
          title="Paragraph style"
          style={{ width: 126 }}
          value={PARA_STYLES.find(s => s.value === formattingState.formatBlock)?.label ?? "Normal text"}
          onMouseDown={noFocusSteal}
          onChange={(e) => {
            const style = PARA_STYLES.find(s => s.label === e.target.value);
            if (style) fmt("formatBlock", style.value);
          }}
          disabled={isReadOnly}
        >
          {PARA_STYLES.map((s) => <option key={s.label}>{s.label}</option>)}
        </select>

        <div className="gdoc-toolbar-sep"/>

        {/* Font family */}
        <select
          className="gdoc-tb-select"
          title="Font"
          style={{ width: 110 }}
          value={FONTS.find(f => f.toLowerCase() === formattingState.fontName.toLowerCase()) ?? "Arial"}
          onMouseDown={noFocusSteal}
          onChange={(e) => fmt("fontName", e.target.value)}
          disabled={isReadOnly}
        >
          {FONTS.map((f) => <option key={f}>{f}</option>)}
        </select>

        <div className="gdoc-toolbar-sep"/>

        {/* Font size */}
        <select
          className="gdoc-tb-select"
          title="Font size"
          style={{ width: 60 }}
          value={formattingState.fontSize || "3"}
          onMouseDown={noFocusSteal}
          onChange={(e) => fmt("fontSize", e.target.value)}
          disabled={isReadOnly}
        >
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="gdoc-toolbar-sep"/>

        {/* B / I / U / S */}
        {tb("Bold (Ctrl+B)",          "bold",          <b>B</b>,   undefined, formattingState.bold)}
        {tb("Italic (Ctrl+I)",        "italic",        <i>I</i>,   undefined, formattingState.italic)}
        {tb("Underline (Ctrl+U)",     "underline",     <u>U</u>,   undefined, formattingState.underline)}
        {tb("Strikethrough",          "strikeThrough", <s>S</s>,   undefined, formattingState.strikeThrough)}

        <div className="gdoc-toolbar-sep"/>

        {/* Text color & highlight (visual stubs — execCommand color support is inconsistent) */}
        <button className="gdoc-tb-btn" title="Text color" onMouseDown={noFocusSteal} onClick={() => fmt("foreColor", "#1a73e8")} disabled={isReadOnly}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>A</span>
            <span style={{ width: 14, height: 3, background: "#1a73e8", borderRadius: 1 }}/>
          </span>
        </button>
        <button className="gdoc-tb-btn" title="Highlight color" onMouseDown={noFocusSteal} onClick={() => fmt("hiliteColor", "#fef08a")} disabled={isReadOnly}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>A</span>
            <span style={{ width: 14, height: 3, background: "#fef08a", borderRadius: 1 }}/>
          </span>
        </button>

        <div className="gdoc-toolbar-sep"/>

        {/* Alignment */}
        {tb("Align left (Ctrl+Shift+L)",   "justifyLeft",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h12M3 18h18"/></svg>,
          undefined, formattingState.justifyLeft
        )}
        {tb("Align center (Ctrl+Shift+E)", "justifyCenter",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M3 18h18"/></svg>,
          undefined, formattingState.justifyCenter
        )}
        {tb("Align right (Ctrl+Shift+R)",  "justifyRight",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M9 12h12M3 18h18"/></svg>,
          undefined, formattingState.justifyRight
        )}
        {tb("Justify",                     "justifyFull",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
          undefined, formattingState.justifyFull
        )}

        <div className="gdoc-toolbar-sep"/>

        {/* Indent / Outdent */}
        {tb("Decrease indent", "outdent",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><polyline points="11 12 7 8 11 4"/><line x1="7" y1="8" x2="7" y2="16"/></svg>
        )}
        {tb("Increase indent", "indent",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/><polyline points="3 12 7 8 3 4"/><line x1="7" y1="8" x2="21" y2="8"/></svg>
        )}

        <div className="gdoc-toolbar-sep"/>

        {/* Lists */}
        {tb("Bulleted list", "insertUnorderedList",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>,
          undefined, formattingState.insertUnorderedList
        )}
        {tb("Numbered list", "insertOrderedList",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4M4 10h2" strokeLinejoin="round"/>
            <path d="M4 14a1 1 0 011-1h1a1 1 0 010 2H4.5a1 1 0 000 2H6" strokeLinejoin="round"/>
          </svg>,
          undefined, formattingState.insertOrderedList
        )}

        <div className="gdoc-toolbar-sep"/>

        {/* Insert link */}
        <button
          className="gdoc-tb-btn"
          title="Insert link (Ctrl+K)"
          onMouseDown={noFocusSteal}
          disabled={isReadOnly}
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) fmt("createLink", url);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
        </button>

        {/* Add comment (stub) */}
        <button className="gdoc-tb-btn" title="Add comment" onMouseDown={noFocusSteal} disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>
    </>
  );
}
