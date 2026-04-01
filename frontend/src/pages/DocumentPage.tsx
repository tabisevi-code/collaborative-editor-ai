import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { AiPanel } from "../components/AiPanel";
import { DocHeader } from "../components/DocHeader";
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

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const [document, setDocument]       = useState<GetDocumentResponse | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftTitle, setDraftTitle]   = useState("");
  const [isLoading, setIsLoading]     = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState]     = useState<SaveState>("saved");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showMeta, setShowMeta]       = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef(0);
  const aiService    = createAiService(apiClient, userId);

  /* ── Load document ─────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      setSaveState("saved");

      try {
        const fetched = await apiClient.getDocument(documentId, userId);
        if (cancelled) return;
        setDocument(fetched);
        setDraftContent(fetched.content);
        setDraftTitle(fetched.title);
      } catch (error) {
        if (cancelled) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
        setErrorMessage(mapDocumentError(apiError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [apiClient, documentId, userId]);

  /* ── Track unsaved state ───────────────────────────────────────────── */
  useEffect(() => {
    if (!document) return;
    const dirty = draftContent !== document.content || draftTitle !== document.title;
    setSaveState((prev) => {
      if (prev === "saving") return prev;
      return dirty ? "unsaved" : "saved";
    });
  }, [draftContent, draftTitle, document]);

  /* ── Save ──────────────────────────────────────────────────────────── */
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
      setDocument((prev) =>
        prev ? { ...prev, content: draftContent, updatedAt: updated.updatedAt, revisionId: updated.revisionId } : prev
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  /* ── Text selection for AI ─────────────────────────────────────────── */
  function captureSelection() {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    if (s !== e) setSelectedText(draftContent.slice(s, e));
  }

  /* ── AI apply ──────────────────────────────────────────────────────── */
  function handleAiApply(suggestion: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraftContent((prev) => prev + "\n\n" + suggestion);
      return;
    }
    const { selectionStart: s, selectionEnd: e } = ta;
    setDraftContent(draftContent.slice(0, s) + suggestion + draftContent.slice(e));
  }

  /* ── Revert ────────────────────────────────────────────────────────── */
  function handleRevert() {
    void (async () => {
      try {
        const refreshed = await apiClient.getDocument(documentId, userId);
        setDocument(refreshed);
        setDraftContent(refreshed.content);
        setDraftTitle(refreshed.title);
        setSaveState("saved");
      } catch { /* silently ignore */ }
    })();
  }

  const isReadOnly = document?.role === "viewer";
  const canRevert  = document?.role === "owner" || document?.role === "editor";

  return (
    <div className="gdoc-shell">
      {/* Header (top bar + menu bar + format toolbar) */}
      <DocHeader
        document={document}
        draftTitle={draftTitle}
        onTitleChange={setDraftTitle}
        saveState={saveState}
        userId={userId}
        onSave={handleSave}
        onAiOpen={() => { captureSelection(); setShowAiPanel(true); }}
        onHistoryOpen={() => setShowVersionPanel(true)}
      />

      {/* Paper area */}
      <div className="gdoc-page-area">
        {isLoading && (
          <div style={{ maxWidth: 816, margin: "0 auto", padding: "1rem 96px" }}>
            <StatusBanner tone="info" title="Loading" message="Fetching document from backend…" />
          </div>
        )}

        {errorMessage && (
          <div style={{ maxWidth: 816, margin: "0 auto", padding: "1rem 96px" }}>
            <StatusBanner tone="error" title="Load Failed" message={errorMessage} />
          </div>
        )}

        {document && (
          <div className="gdoc-page">
            {isReadOnly && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner tone="warning" title="View-only" message="You have viewer access — editing is disabled." />
              </div>
            )}

            {saveState === "error" && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner tone="error" title="Save failed" message="Could not save — the save endpoint may not be available yet." />
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="gdoc-editor"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              readOnly={isReadOnly}
              aria-label="Document content"
              spellCheck
              autoFocus={!isReadOnly}
            />

            {showMeta && (
              <div style={{ marginTop: "2rem", borderTop: "1px solid var(--gd-border)", paddingTop: "1.5rem" }}>
                <MetadataCard document={document} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <footer className="gdoc-statusbar">
        {document && (
          <>
            <button className="gdoc-statusbar-btn" onClick={() => setShowMeta((v) => !v)}>
              {showMeta ? "Hide" : "Info"}
            </button>
            <span>·</span>
            <span>{wordCount(draftContent).toLocaleString()} words</span>
            <span>·</span>
            <span>{draftContent.length.toLocaleString()} characters</span>
            {document.updatedAt && (
              <>
                <span>·</span>
                <span>
                  Last updated{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  }).format(new Date(document.updatedAt))}
                </span>
              </>
            )}
          </>
        )}
      </footer>

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
