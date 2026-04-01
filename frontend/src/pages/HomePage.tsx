import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError } from "../types/api";

interface HomePageProps {
  apiClient: ApiClient;
  userId: string;
}

function mapError(error: ApiError): string {
  if (error.status === 400 || error.status === 413) return error.message;
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and try again.";
  return "Request failed. Please try again.";
}

const TEMPLATES = [
  { name: "Blank",         icon: null },
  { name: "Resume",        icon: "📄" },
  { name: "Letter",        icon: "✉️" },
  { name: "Project brief", icon: "📋" },
  { name: "Meeting notes", icon: "📝" },
];

export function HomePage({ apiClient, userId }: HomePageProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle]           = useState("");
  const [content, setContent]       = useState("");
  const [openId, setOpenId]         = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await apiClient.createDocument({ title: title || "Untitled document", content }, userId);
      navigate(`/documents/${created.documentId}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapError(apiError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenSubmit(e: FormEvent) {
    e.preventDefault();
    if (openId.trim()) navigate(`/documents/${encodeURIComponent(openId.trim())}`);
  }

  function handleTemplateClick(templateName: string) {
    setTitle(templateName === "Blank" ? "" : templateName);
    setContent("");
    setShowCreateModal(true);
  }

  return (
    <div style={{ flex: 1, background: "var(--gd-surface)" }}>
      {/* Templates strip */}
      <div className="templates-strip">
        <div className="templates-strip-inner">
          <div className="templates-header">
            <h2>Start a new document</h2>
            <a>Template gallery</a>
          </div>
          <div className="templates-grid">
            {TEMPLATES.map((t) => (
              <div key={t.name} className="template-card" onClick={() => handleTemplateClick(t.name)} role="button" tabIndex={0}>
                <div className="template-preview">
                  {t.icon ? (
                    <span style={{ fontSize: 32 }}>{t.icon}</span>
                  ) : (
                    <div className="template-blank-preview" />
                  )}
                </div>
                <div className="template-name">{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent / open section */}
      <div className="recent-section">
        <div className="recent-header">
          <h2>Recent documents</h2>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button className="gd-icon-btn" style={{ width: 36, height: 36 }} title="List view">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button className="gd-icon-btn" style={{ width: 36, height: 36 }} title="Grid view">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          </div>
        </div>

        {/* Open by ID */}
        <form className="open-doc-form" onSubmit={handleOpenSubmit}>
          <input
            className="open-doc-input"
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
            placeholder="Paste a document ID to open…"
            aria-label="Document ID"
            spellCheck={false}
          />
          <button
            className="btn btn-secondary btn-sm"
            type="submit"
            disabled={!openId.trim()}
          >
            Open
          </button>
        </form>

        {/* Empty state */}
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--gd-text-2)" }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: "1rem", opacity: 0.4 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p style={{ fontSize: 14 }}>No recent documents. Create one using the templates above.</p>
        </div>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300 }}
            onClick={() => setShowCreateModal(false)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: "min(480px, calc(100vw - 2rem))",
            background: "var(--gd-surface)", borderRadius: 8, padding: "1.5rem",
            boxShadow: "0 8px 32px rgba(0,0,0,.2)",
            zIndex: 301, display: "flex", flexDirection: "column", gap: "1.25rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 400 }}>New document</h2>
              <button className="gd-icon-btn" onClick={() => setShowCreateModal(false)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="field">
                <label className="field-label" htmlFor="new-title">Title</label>
                <input
                  id="new-title"
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled document"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-content">
                  Initial content <span style={{ textTransform: "none", fontWeight: 400, color: "var(--gd-text-3)" }}>(optional)</span>
                </label>
                <textarea
                  id="new-content"
                  className="text-input"
                  style={{ minHeight: 100, resize: "vertical" }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing…"
                />
              </div>

              {errorMessage && <StatusBanner tone="error" title="Error" message={errorMessage} />}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
