import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRealtimeDocument } from "../hooks/useRealtimeDocument";
import { AiPanel, type AiApplyPayload } from "../components/AiPanel";
import { AiPolicyPanel } from "../components/AiPolicyPanel";
import { DocHeader } from "../components/DocHeader";
import { ExportPanel } from "../components/ExportPanel";
import { MetadataCard } from "../components/MetadataCard";
import { RichEditor, type RichEditorHandle } from "../components/RichEditor";
import { PermissionsPanel } from "../components/PermissionsPanel";
import { StatusBanner } from "../components/StatusBanner";
import { VersionHistoryPanel } from "../components/VersionHistoryPanel";
import type { ToolbarAction } from "../lib/richTextToolbar";
import {
  isViewerRole,
  mapDocumentError,
  mapSaveError,
  type SaveState,
  toPlainText,
  toRealtimeStatusLabel,
  wordCount,
} from "./documentPageUtils";
import type { ApiClient } from "../services/api";
import { createAiService, type AiSelectionSnapshot } from "../services/ai";
import type { DashboardService } from "../services/dashboard";
import { ApiError, type GetDocumentResponse, type TextSelection } from "../types/api";

interface DocumentPageProps {
  apiClient: ApiClient;
  dashboardService: DashboardService;
  userId: string;
  displayName: string;
  onSignOut(): void;
}

const AUTO_SAVE_DELAY_MS = 1200;

/**
 * This page treats the collaborative Yjs document as the live source of text.
 * The REST document snapshot is still critical for permissions, save/version
 * metadata, and recovery paths such as conflicts or revert.
 */
export function DocumentPage({ apiClient, dashboardService, userId, displayName, onSignOut }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [fallbackContent, setFallbackContent] = useState("");
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [syncNoticeMessage, setSyncNoticeMessage] = useState<string | null>(null);
  const [hasStaleRevisionConflict, setHasStaleRevisionConflict] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showPermissionsPanel, setShowPermissionsPanel] = useState(false);
  const [showAiPolicyPanel, setShowAiPolicyPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  const editorRef = useRef<RichEditorHandle>(null);
  const requestIdRef = useRef(0);
  const aiService = createAiService(apiClient);
  const realtimeDocument = useRealtimeDocument({
    apiClient,
    document,
    userId,
    onDocumentReverted: () => {
      setSyncNoticeMessage("A remote revert was applied. Version metadata has been refreshed.");
      setHasStaleRevisionConflict(false);
      void loadDocument();
    },
    onAccessRevoked: () => {
      setSaveErrorMessage("Your access was revoked while this document was open. Editing is now disabled.");
    },
  });

  const visibleContent = realtimeDocument.collaborationReady
    ? realtimeDocument.collaborationText
    : fallbackContent;
  const isViewer = isViewerRole(realtimeDocument.role);
  const isReadOnly = realtimeDocument.accessRevoked || isViewer;
  const canManagePermissions = realtimeDocument.role === "owner";
  const canManageAiPolicy = realtimeDocument.role === "owner";
  const canRevert = realtimeDocument.role === "owner";
  const collaboratorCount = realtimeDocument.remotePeers.length;
  const realtimeStatus = toRealtimeStatusLabel(realtimeDocument.realtimeState, collaboratorCount);

  function applyVisibleContent(nextValue: string, reason: string) {
    console.debug("[document-page] content_updated", {
      reason,
      collaborationReady: realtimeDocument.collaborationReady,
      length: nextValue.length,
    });

    if (realtimeDocument.collaborationReady) {
      const didApply = realtimeDocument.applyLocalChange(nextValue);
      if (!didApply) {
        setSaveErrorMessage("This document is currently read-only.");
      }
      return;
    }

    setFallbackContent(nextValue);
  }

  function syncSelection(nextSelection: TextSelection, content: string) {
    setSelection(nextSelection);
    const plainText = toPlainText(content);
    setSelectedText(nextSelection.start === nextSelection.end ? "" : plainText.slice(nextSelection.start, nextSelection.end));

    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();
      editor.setSelection(nextSelection);
    });
  }

  async function loadDocument({
    reloadCollaboration = false,
  }: {
    reloadCollaboration?: boolean;
  } = {}) {
    setIsLoading(true);
    setErrorMessage(null);
    setLoadErrorCode(null);

    try {
      const fetched = await apiClient.getDocument(documentId, userId);
      console.info("[document-page] document_loaded", {
        documentId: fetched.documentId,
        role: fetched.role,
        revisionId: fetched.revisionId,
      });
      setDocument(fetched);
      setDraftTitle(fetched.title);
      setFallbackContent(fetched.content);
      await dashboardService.rememberDocument(userId, fetched);

      if (reloadCollaboration) {
        realtimeDocument.applyRemoteReset(fetched.content);
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      if (apiError.status === 401) {
        onSignOut();
      }
      setLoadErrorCode(apiError.code);
      setErrorMessage(
        apiError.status === 404 ? "This document no longer exists. Returning to the home page..." : mapDocumentError(apiError)
      );
      setDocument(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocument();
  }, [apiClient, documentId, userId]);

  useEffect(() => {
    if (loadErrorCode !== "NOT_FOUND") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadErrorCode, navigate]);

  useEffect(() => {
    if (!document) {
      return;
    }

    if (saveState === "saving") {
      return;
    }

    const liveText = realtimeDocument.collaborationReady ? realtimeDocument.collaborationText : fallbackContent;
    setSaveState(liveText === document.content ? "saved" : "unsaved");
  }, [realtimeDocument.collaborationReady, realtimeDocument.collaborationText, fallbackContent, document, saveState]);

  useEffect(() => {
    const activeText = toPlainText(realtimeDocument.collaborationReady ? realtimeDocument.collaborationText : fallbackContent);
    const { start, end } = selection;
    setSelectedText(end > start ? activeText.slice(start, end) : "");
  }, [realtimeDocument.collaborationReady, realtimeDocument.collaborationText, fallbackContent, selection]);

  useEffect(() => {
    if (!document || isReadOnly || saveState !== "unsaved") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [document?.documentId, document?.revisionId, isReadOnly, saveState, visibleContent]);

  function nextRequestId(prefix: string) {
    requestIdRef.current += 1;
    return `${prefix}_${Date.now()}_${requestIdRef.current}`;
  }

  async function recordAiFeedback(
    jobId: string | null,
    disposition: "applied_full" | "applied_partial" | "rejected",
    feedback?: { appliedText?: string; appliedRange?: TextSelection; documentId?: string; edited?: boolean }
  ) {
    if (!jobId) {
      return;
    }

    try {
      await aiService.recordFeedback(jobId, disposition, feedback);
    } catch (error) {
      console.warn("[document-page] ai_feedback_failed", {
        jobId,
        disposition,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function reloadLatestDocument() {
    setHasStaleRevisionConflict(false);
    setSaveErrorMessage(null);
    await loadDocument({ reloadCollaboration: true });
  }

  async function handleSave(options: {
    content?: string;
    preUpdateVersionReason?: string;
    updateReason?: string;
    aiJobId?: string | null;
  } = {}) {
    if (!document || saveState === "saving") {
      return false;
    }

    const liveText = options.content ?? (realtimeDocument.getText() || visibleContent);
    setSaveState("saving");
    setSaveErrorMessage(null);
    setSyncNoticeMessage(null);
    setHasStaleRevisionConflict(false);

    async function saveWithRevision(baseRevisionId: string) {
      await apiClient.updateDocument(
        documentId,
        {
          content: liveText,
          requestId: nextRequestId("save"),
          baseRevisionId,
          preUpdateVersionReason: options.preUpdateVersionReason,
          updateReason: options.updateReason,
          aiJobId: options.aiJobId ?? undefined,
        },
        userId
      );
    }

    try {
      await saveWithRevision(document.revisionId);

      await loadDocument();
      setSaveState("saved");
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && realtimeDocument.collaborationReady) {
        try {
          const latestDocument = await apiClient.getDocument(documentId, userId);

          if (latestDocument.content === liveText) {
            setDocument(latestDocument);
            setDraftTitle(latestDocument.title);
            setFallbackContent(latestDocument.content);
            setSaveState("saved");
            return true;
          }

          await saveWithRevision(latestDocument.revisionId);
          await loadDocument();
          setSaveState("saved");
          return true;
        } catch (retryError) {
          error = retryError;
        }
      }

      const mapped = mapSaveError(error);
      if (error instanceof ApiError && error.status === 401) {
        onSignOut();
      }
      setSaveState("error");
      setSaveErrorMessage(mapped.message);
      setHasStaleRevisionConflict(mapped.stale);
      return false;
    }
  }

  function captureSelection() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextSelectedText = editor.captureSelection();
    const nextSelection = editor.getSelection();
    setSelection(nextSelection);
    setSelectedText(nextSelectedText);
    realtimeDocument.setCursorSelection(nextSelection.start === nextSelection.end ? null : nextSelection);
  }

  function handleEditorChange(nextText: string) {
    setSyncNoticeMessage(null);
    applyVisibleContent(nextText, "typing");
  }

  async function handleAiApply(payload: AiApplyPayload) {
    if (!document) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const targetSelection = payload.targetSelection;
    const activePlainText = toPlainText(realtimeDocument.getText() || visibleContent);
    const currentRangeText = activePlainText.slice(targetSelection.start, targetSelection.end);
    if (currentRangeText !== payload.sourceText) {
      throw new Error("The selected text changed before the AI result was applied. Re-run AI on the latest text.");
    }

    editor.replaceSelection(payload.text, targetSelection);
    const nextContent = editor.getHTML();
    applyVisibleContent(nextContent, "ai-apply");

    const nextCursor = targetSelection.start + payload.text.length;
    syncSelection({ start: nextCursor, end: nextCursor }, nextContent);

    const saved = await handleSave({
      content: nextContent,
      preUpdateVersionReason: "pre_ai_apply",
      updateReason: payload.mode === "partial" ? "ai_apply_partial" : "ai_apply",
      aiJobId: payload.jobId,
    });

    if (saved) {
      await recordAiFeedback(payload.jobId, payload.mode === "partial" ? "applied_partial" : "applied_full", {
        appliedText: payload.text,
        appliedRange: {
          start: targetSelection.start,
          end: targetSelection.start + payload.text.length,
        },
        documentId,
        edited: payload.edited,
      });
    }
  }

  function handleRevert() {
    setSaveErrorMessage(null);
    setSyncNoticeMessage(null);
    setHasStaleRevisionConflict(false);
    void loadDocument();
  }

  function buildAiSelectionSnapshot(): AiSelectionSnapshot | null {
    if (!document) {
      return null;
    }

    const { start, end } = selection;
    const activeText = toPlainText(realtimeDocument.getText() || visibleContent);
    if (end <= start) {
      return null;
    }

    return {
      selection,
      selectedText: activeText.slice(start, end),
      contextBefore: activeText.slice(Math.max(0, start - 120), start),
      contextAfter: activeText.slice(end, Math.min(activeText.length, end + 120)),
      baseVersionId: document.currentVersionId,
    };
  }

  function handleUseWholeDocument() {
    const activeText = toPlainText(realtimeDocument.getText() || visibleContent);
    if (!activeText.length) {
      return;
    }

    const wholeSelection = { start: 0, end: activeText.length };
    syncSelection(wholeSelection, visibleContent);
    realtimeDocument.setCursorSelection(wholeSelection);
  }

  function handleToolbarAction(action: ToolbarAction) {
    if (realtimeDocument.role === "viewer" || realtimeDocument.accessRevoked) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const commandMap: Record<ToolbarAction, [string, string?]> = {
      bold: ["bold"],
      italic: ["italic"],
      underline: ["underline"],
      strike: ["strikeThrough"],
      bulletList: ["insertUnorderedList"],
      numberedList: ["insertOrderedList"],
      paragraph: ["formatBlock", "<p>"],
      heading1: ["formatBlock", "<h1>"],
      heading2: ["formatBlock", "<h2>"],
      heading3: ["formatBlock", "<h3>"],
      codeBlock: ["formatBlock", "<pre>"],
      undo: ["undo"],
      redo: ["redo"],
    };
    const [command, value] = commandMap[action];
    editor.format(command, value);
  }

  return (
    <div className="gdoc-shell">
      <DocHeader
        document={document ? { ...document, role: realtimeDocument.role } : null}
        draftTitle={draftTitle}
        canEditTitle={false}
        onTitleChange={setDraftTitle}
        saveState={saveState}
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        realtimeStatus={realtimeStatus}
        onSave={handleSave}
        onAiOpen={() => {
          captureSelection();
          setShowAiPanel(true);
        }}
        onHistoryOpen={() => setShowVersionPanel(true)}
        onPermissionsOpen={canManagePermissions ? () => setShowPermissionsPanel(true) : undefined}
        onAiPolicyOpen={canManageAiPolicy ? () => setShowAiPolicyPanel(true) : undefined}
        onExportOpen={() => setShowExportPanel(true)}
        onToolbarAction={handleToolbarAction}
      />

      <div className="gdoc-page-area">
        {isLoading && (
          <div style={{ maxWidth: 816, margin: "0 auto", padding: "1rem 96px" }}>
            <StatusBanner tone="info" title="Loading" message="Fetching document from backend…" />
          </div>
        )}

        {errorMessage && (
          <div style={{ maxWidth: 816, margin: "0 auto", padding: "1rem 96px" }}>
            <StatusBanner tone="error" title="Load failed" message={errorMessage} />
            {loadErrorCode === "NOT_FOUND" && (
              <div style={{ marginTop: "0.75rem" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate("/", { replace: true })}>
                  Go back home now
                </button>
              </div>
            )}
          </div>
        )}

        {document && (
          <div className="gdoc-document-stack">
            {(isReadOnly || !realtimeDocument.collaborationReady) && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner
                  tone={isReadOnly ? "warning" : "info"}
                  title={isReadOnly ? "View-only" : "Offline editing"}
                  message={
                    realtimeDocument.accessRevoked
                      ? "Your access was revoked while this document was open. Refresh or return home."
                      : isViewer
                        ? "You have viewer access — editing is disabled."
                        : "Realtime collaboration is unavailable. You can keep editing locally and save manually."
                  }
                />
              </div>
            )}

            {realtimeDocument.realtimeError && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner tone="warning" title="Realtime notice" message={realtimeDocument.realtimeError} />
              </div>
            )}

            {saveErrorMessage && (
              <div style={{ marginBottom: "1rem" }} className="stack">
                <StatusBanner
                  tone={hasStaleRevisionConflict ? "warning" : "error"}
                  title={hasStaleRevisionConflict ? "Revision conflict" : "Save failed"}
                  message={saveErrorMessage}
                />
                {hasStaleRevisionConflict && (
                  <div>
                    <button className="btn btn-secondary btn-sm" onClick={() => void reloadLatestDocument()}>
                      Reload latest saved version
                    </button>
                  </div>
                )}
              </div>
            )}

            {syncNoticeMessage && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner tone="info" title="Document updated" message={syncNoticeMessage} />
              </div>
            )}

            {realtimeDocument.remotePeers.length > 0 && (
              <div className="gdoc-collaborator-overlay" aria-label="Live collaborators">
                {realtimeDocument.remotePeers.map((peer) => (
                  <div key={peer.clientId} className="gdoc-collaborator-chip">
                    <span className="gdoc-collaborator-dot" style={{ backgroundColor: peer.color }} />
                    <span>{peer.userId}</span>
                    {peer.selection && <span className="gdoc-collaborator-meta">editing selection</span>}
                  </div>
                ))}
              </div>
            )}

            <RichEditor
              ref={editorRef}
              value={visibleContent}
              remotePeers={realtimeDocument.remotePeers}
              onChange={handleEditorChange}
              onSelectionChange={(nextSelection, nextSelectedText) => {
                setSelection(nextSelection);
                setSelectedText(nextSelectedText);
                realtimeDocument.setCursorSelection(
                  nextSelection.start === nextSelection.end ? null : nextSelection
                );
              }}
              readOnly={isReadOnly}
              autoFocus={!isReadOnly}
              className="gdoc-page rich-editor-page"
            />

            {showMeta && (
              <div className="gdoc-meta-panel">
                <MetadataCard document={{ ...document, role: realtimeDocument.role }} />
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="gdoc-statusbar">
        {document && (
          <>
            <button className="gdoc-statusbar-btn" onClick={() => setShowMeta((value) => !value)}>
              {showMeta ? "Hide" : "Info"}
            </button>
            <span>·</span>
            <span>{wordCount(visibleContent).toLocaleString()} words</span>
            <span>·</span>
            <span>{toPlainText(visibleContent).length.toLocaleString()} characters</span>
            <span>·</span>
            <span>{collaboratorCount > 0 ? `${collaboratorCount + 1} people connected` : "Only you connected"}</span>
            {document.updatedAt && (
              <>
                <span>·</span>
                <span>
                  Last saved{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(document.updatedAt))}
                </span>
              </>
            )}
          </>
        )}
      </footer>

      {showAiPanel && document && (
        <AiPanel
          documentId={documentId}
          snapshot={
            buildAiSelectionSnapshot() || {
              selection,
              selectedText,
              contextBefore: "",
              contextAfter: "",
              baseVersionId: document.currentVersionId,
            }
          }
          selectedText={selectedText}
          aiService={aiService}
          onUseWholeDocument={handleUseWholeDocument}
          onApply={handleAiApply}
          onReject={(jobId) => recordAiFeedback(jobId, "rejected")}
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

      {showPermissionsPanel && (
        <PermissionsPanel
          documentId={documentId}
          userId={userId}
          apiClient={apiClient}
          onClose={() => setShowPermissionsPanel(false)}
        />
      )}

      {showAiPolicyPanel && (
        <AiPolicyPanel
          documentId={documentId}
          userId={userId}
          apiClient={apiClient}
          onClose={() => setShowAiPolicyPanel(false)}
        />
      )}

      {showExportPanel && (
        <ExportPanel
          documentId={documentId}
          userId={userId}
          apiClient={apiClient}
          onClose={() => setShowExportPanel(false)}
        />
      )}
    </div>
  );
}
