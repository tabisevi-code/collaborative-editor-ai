import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { AiPanel } from "../components/AiPanel";
import { DocHeader } from "../components/DocHeader";
import { MetadataCard } from "../components/MetadataCard";
import { RichEditor, INITIAL_FORMATTING, type FormattingState, type RichEditorHandle } from "../components/RichEditor";
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

function stripHTML(html: string): string {
  const div = window.document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? "";
}

function wordCount(html: string): number {
  const text = stripHTML(html).trim();
  return text === "" ? 0 : text.split(/\s+/).length;
}

export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();

  const [document, setDocument]         = useState<GetDocumentResponse | null>(null);
  const [draftTitle, setDraftTitle]     = useState("");
  const [isLoading, setIsLoading]       = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState]       = useState<SaveState>("saved");
  const [formattingState, setFormattingState] = useState<FormattingState>(INITIAL_FORMATTING);
  const [showAiPanel, setShowAiPanel]         = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showMeta, setShowMeta]               = useState(false);
  const [selectedText, setSelectedText]       = useState("");

  const editorRef    = useRef<RichEditorHandle>(null);
  const requestIdRef = useRef(0);
  const isDirty      = useRef(false);
  const savedContent = useRef("");

  const aiService = createAiService(apiClient, userId);

  // ── Load document ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      setSaveState("saved");
      isDirty.current = false;

      try {
        const fetched = await apiClient.getDocument(documentId, userId);
        if (cancelled) return;
        setDocument(fetched);
        setDraftTitle(fetched.title);
        savedContent.current = fetched.content;
        // RichEditor will pick up initialHTML on its first render
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

  // ── Track save state when content changes ─────────────────────────────
  function handleContentChange(html: string) {
    if (html !== savedContent.current) {
      isDirty.current = true;
      setSaveState("unsaved");
    } else {
      isDirty.current = false;
      setSaveState("saved");
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!document || saveState === "saving") return;
    const html = editorRef.current?.getHTML() ?? "";

    setSaveState("saving");
    requestIdRef.current += 1;
    const requestId = `req_${Date.now()}_${requestIdRef.current}`;

    try {
      const updated = await apiClient.updateDocument(documentId, { content: html, requestId }, userId);
      savedContent.current = html;
      setDocument((prev) => prev
        ? { ...prev, content: html, updatedAt: updated.updatedAt, revisionId: updated.revisionId }
        : prev
      );
      setSaveState("saved");
      isDirty.current = false;
    } catch {
      setSaveState("error");
    }
  }

  // ── Format command (from toolbar) ─────────────────────────────────────
  function handleFormat(command: string, value?: string) {
    editorRef.current?.format(command, value);
  }

  // ── AI ────────────────────────────────────────────────────────────────
  function handleAiOpen() {
    const text = editorRef.current?.captureSelection() ?? "";
    setSelectedText(text);
    setShowAiPanel(true);
  }

  function handleAiApply(suggestion: string) {
    editorRef.current?.replaceSelection(suggestion);
    const html = editorRef.current?.getHTML() ?? "";
    handleContentChange(html);
  }

  // ── Revert ────────────────────────────────────────────────────────────
  function handleRevert() {
    void (async () => {
      try {
        const refreshed = await apiClient.getDocument(documentId, userId);
        setDocument(refreshed);
        setDraftTitle(refreshed.title);
        savedContent.current = refreshed.content;
        // Force editor re-init by re-mounting with new key handled inside RichEditor
        if (editorRef.current) {
          // RichEditor won't re-init because initialized.current is true —
          // manually set innerHTML to refreshed content
          const div = (editorRef.current as unknown as { divRef?: { current: HTMLDivElement | null } }).divRef?.current;
          if (div) {
            div.innerHTML = refreshed.content || "<p><br></p>";
          }
        }
        setSaveState("saved");
        isDirty.current = false;
      } catch { /* ignore */ }
    })();
  }

  const isReadOnly = document?.role === "viewer";
  const canRevert  = document?.role === "owner" || document?.role === "editor";
  const currentHTML = editorRef.current?.getHTML() ?? document?.content ?? "";

  return (
    <div className="gdoc-shell">
      <DocHeader
        document={document}
        draftTitle={draftTitle}
        onTitleChange={setDraftTitle}
        saveState={saveState}
        userId={userId}
        onSave={handleSave}
        onAiOpen={handleAiOpen}
        onHistoryOpen={() => setShowVersionPanel(true)}
        formattingState={formattingState}
        onFormat={handleFormat}
      />

      {/* Paper canvas */}
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
              <div style={{ marginBottom: "1.5rem" }}>
                <StatusBanner tone="warning" title="View-only" message="You have viewer access — editing is disabled." />
              </div>
            )}
            {saveState === "error" && (
              <div style={{ marginBottom: "1.5rem" }}>
                <StatusBanner tone="error" title="Save failed" message="Could not reach the save endpoint. Changes remain local." />
              </div>
            )}

            <RichEditor
              ref={editorRef}
              initialHTML={document.content}
              onChange={handleContentChange}
              onSelectionChange={setFormattingState}
              readOnly={isReadOnly}
              className="gdoc-editor"
            />

            {showMeta && (
              <div style={{ marginTop: "2.5rem", borderTop: "1px solid var(--gd-border)", paddingTop: "1.5rem" }}>
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
              {showMeta ? "Hide info" : "Info"}
            </button>
            <span>·</span>
            <span>{wordCount(currentHTML).toLocaleString()} words</span>
            <span>·</span>
            <span>
              Updated{" "}
              {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(document.updatedAt))}
            </span>
          </>
        )}
      </footer>

      {showAiPanel && document && (
        <AiPanel
          documentId={documentId}
          selectedText={selectedText}
          aiService={aiService}
          onApply={handleAiApply}
          onClose={() => setShowAiPanel(false)}
        />
      )}

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
