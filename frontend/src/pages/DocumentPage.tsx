import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AiPanel } from "../components/AiPanel";
import { MetadataCard } from "../components/MetadataCard";
import { StatusBanner } from "../components/StatusBanner";
import { VersionHistoryPanel } from "../components/VersionHistoryPanel";
import type { ApiClient } from "../services/api";
import { createAiService } from "../services/ai";
import { ApiError, type GetDocumentResponse } from "../types/api";

interface DocumentPageProps {
  apiClient: ApiClient;
  userId: string;
}

type SaveState = "saved" | "unsaved" | "saving" | "error";

function mapDocumentError(error: ApiError): string {
  if (error.status === 404) return "Document not found.";
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and refresh.";
  return error.message || "The document could not be loaded.";
}

function SaveIndicator({ state }: { state: SaveState }) {
  const labels: Record<SaveState, string> = {
    saved: "Saved",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    error: "Save failed",
  };
  return (
    <span className={`save-indicator ${state}`}>
      <span className={`save-dot${state === "saving" ? " pulse" : ""}`} />
      {labels[state]}
    </span>
  );
}

export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showMeta, setShowMeta] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef(0);
  const aiService = createAiService(apiClient, userId);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      setIsLoading(true);
      setErrorMessage(null);
      setSaveState("saved");

      try {
        const fetched = await apiClient.getDocument(documentId, userId);
        if (cancelled) return;

        console.info("[frontend-document] document_loaded", {
          documentId: fetched.documentId,
          role: fetched.role,
        });
        setDocument(fetched);
        setDraftContent(fetched.content);
      } catch (error) {
        if (cancelled) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
        setErrorMessage(mapDocumentError(apiError));
        setDocument(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadDocument();
    return () => { cancelled = true; };
  }, [apiClient, documentId, userId]);

  useEffect(() => {
    if (document === null) return;
    setSaveState(draftContent !== document.content ? "unsaved" : "saved");
  }, [draftContent, document]);

  async function handleSave() {
    if (!document || saveState === "saving") return;

    setSaveState("saving");
    requestIdRef.current += 1;
    const requestId = `req_${Date.now()}_${requestIdRef.current}`;

    try {
      const updated = await apiClient.updateDocument(
        documentId,
        { content: draftContent, requestId },
        userId
      );
      setDocument((prev) => prev ? { ...prev, content: draftContent, updatedAt: updated.updatedAt, revisionId: updated.revisionId } : prev);
      setSaveState("saved");
    } catch (error) {
      console.warn("[frontend-document] save_failed", error);
      setSaveState("error");
    }
  }

  function handleSelectionCapture() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart !== selectionEnd) {
      setSelectedText(draftContent.slice(selectionStart, selectionEnd));
    }
  }

  function handleAiApply(suggestion: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraftContent((prev) => prev + "\n" + suggestion);
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    const next =
      draftContent.slice(0, selectionStart) +
      suggestion +
      draftContent.slice(selectionEnd);
    setDraftContent(next);
  }

  function handleRevert() {
    void (async () => {
      try {
        const refreshed = await apiClient.getDocument(documentId, userId);
        setDocument(refreshed);
        setDraftContent(refreshed.content);
        setSaveState("saved");
      } catch {
        // silently ignore refresh errors
      }
    })();
  }

  const isReadOnly = document?.role === "viewer";
  const canRevert = document?.role === "owner" || document?.role === "editor";

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="eyebrow">Document</p>
          <h2 className="doc-title">{document?.title || documentId}</h2>
          {document && (
            <div className="doc-subtitle">
              <span
                className={`role-badge role-badge-${document.role}`}
              >
                {document.role}
              </span>
              <span>·</span>
              <span>
                Updated{" "}
                {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(document.updatedAt))}
              </span>
              {!isReadOnly && <SaveIndicator state={saveState} />}
            </div>
          )}
        </div>
        <Link className="btn btn-secondary btn-sm" to="/">
          ← Back
        </Link>
      </div>

      {isLoading && (
        <StatusBanner tone="info" title="Loading" message="Fetching document from backend…" />
      )}
      {errorMessage && (
        <StatusBanner tone="error" title="Load Failed" message={errorMessage} />
      )}

      {document && (
        <>
          {/* Toolbar */}
          <div className="doc-toolbar">
            <div className="doc-toolbar-left">
              {!isReadOnly && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saveState === "saving" || saveState === "saved"}
                >
                  {saveState === "saving" ? "Saving…" : "Save"}
                </button>
              )}
              {isReadOnly && (
                <span className="status-banner status-warning" style={{ padding: "0.3rem 0.75rem", display: "inline-flex" }}>
                  👁 View-only
                </span>
              )}
            </div>
            <div className="doc-toolbar-right">
              <button
                className="btn btn-ai btn-sm"
                onClick={() => { handleSelectionCapture(); setShowAiPanel(true); }}
                disabled={isReadOnly}
                title={isReadOnly ? "AI editing is disabled in view-only mode" : "Open AI assistant"}
              >
                ✨ AI
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowVersionPanel(true)}
              >
                🕓 History
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowMeta((v) => !v)}
              >
                {showMeta ? "Hide info" : "Info"}
              </button>
            </div>
          </div>

          {saveState === "error" && (
            <StatusBanner tone="error" title="Save failed" message="Could not save to backend. The save API may not be available yet." />
          )}

          {/* Editor */}
          <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <textarea
              ref={textareaRef}
              className="editor-input"
              style={{ border: "none", borderRadius: "inherit", minHeight: "420px", background: "var(--color-surface)" }}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onMouseUp={handleSelectionCapture}
              onKeyUp={handleSelectionCapture}
              readOnly={isReadOnly}
              aria-label="Document content"
              spellCheck
            />
          </section>

          {/* Metadata (collapsible) */}
          {showMeta && <MetadataCard document={document} />}
        </>
      )}

      {/* AI Side Panel */}
      {showAiPanel && document && (
        <AiPanel
          documentId={documentId}
          selectedText={selectedText}
          aiService={aiService}
          onApply={handleAiApply}
          onClose={() => setShowAiPanel(false)}
        />
      )}

      {/* Version History Panel */}
      {showVersionPanel && (
        <VersionHistoryPanel
          documentId={documentId}
          userId={userId}
          apiClient={apiClient}
          canRevert={canRevert}
          onRevert={handleRevert}
          onClose={() => setShowVersionPanel(false)}
        />
      )}
    </div>
  );
}
