import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError } from "../types/api";

interface HomePageProps {
  apiClient: ApiClient;
  userId: string;
}

function mapHomeError(error: ApiError): string {
  if (error.status === 400 || error.status === 413) return error.message;
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and try again.";
  return "Request could not be completed. Please try again.";
}

export function HomePage({ apiClient, userId }: HomePageProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentIdToOpen, setDocumentIdToOpen] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await apiClient.createDocument({ title, content }, userId);
      console.info("[frontend-home] document_created", { documentId: created.documentId });
      navigate(`/documents/${created.documentId}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapHomeError(apiError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsOpening(true);
    const trimmedId = documentIdToOpen.trim();
    navigate(`/documents/${encodeURIComponent(trimmedId)}`);
  }

  return (
    <div className="page-stack">
      {/* Hero */}
      <div className="home-hero">
        <p className="eyebrow">Collaborative Editor AI</p>
        <h1>Write, collaborate, and improve with AI</h1>
        <p>Create documents, share with your team, and use AI to rewrite, summarize, or translate your content.</p>
      </div>

      {/* Two-column grid */}
      <div className="page-grid">
        {/* Create document */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>New Document</h2>
              <p>Start writing — you'll become the owner.</p>
            </div>
          </div>

          <form className="stack" onSubmit={handleCreateSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="doc-title">Title</label>
              <input
                id="doc-title"
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Quarterly review notes"
                aria-label="Document title"
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="doc-content">Initial content <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(optional)</span></label>
              <textarea
                id="doc-content"
                className="editor-input"
                style={{ minHeight: "160px" }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing, or leave blank…"
                aria-label="Initial content"
              />
            </div>

            {errorMessage && (
              <StatusBanner tone="error" title="Error" message={errorMessage} />
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSubmitting || !title.trim()}
              style={{ alignSelf: "flex-start" }}
            >
              {isSubmitting ? "Creating…" : "Create Document →"}
            </button>
          </form>
        </section>

        {/* Right column */}
        <div className="stack">
          {/* Open existing */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Open Document</h2>
                <p>Paste a document ID to open it.</p>
              </div>
            </div>

            <form className="stack" onSubmit={handleOpenSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="open-id">Document ID</label>
                <input
                  id="open-id"
                  className="text-input"
                  value={documentIdToOpen}
                  onChange={(e) => setDocumentIdToOpen(e.target.value)}
                  placeholder="doc_abc123"
                  aria-label="Document ID"
                  spellCheck={false}
                />
              </div>
              <button
                className="btn btn-secondary"
                type="submit"
                disabled={isOpening || !documentIdToOpen.trim()}
                style={{ alignSelf: "flex-start" }}
              >
                {isOpening ? "Opening…" : "Open →"}
              </button>
            </form>
          </section>

          {/* Feature overview */}
          <section className="panel">
            <div className="panel-header">
              <h2>Features</h2>
            </div>
            <div className="stack" style={{ gap: "0.6rem" }}>
              {[
                { icon: "✏️", label: "Real-time collaboration", note: "Coming soon" },
                { icon: "✨", label: "AI rewrite / summarize / translate", note: "Requires AI backend" },
                { icon: "🕓", label: "Version history & revert", note: "Requires backend" },
                { icon: "🔒", label: "Role-based access control", note: "owner · editor · viewer" },
              ].map(({ icon, label, note }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "14px" }}>
                  <span style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{icon}</span>
                  <div>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    <span style={{ marginLeft: "0.4rem", fontSize: "12px", color: "var(--color-text-muted)" }}>{note}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
