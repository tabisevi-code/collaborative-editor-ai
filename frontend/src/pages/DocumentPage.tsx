import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { AiPanel } from "../components/AiPanel";
import { AiPolicyPanel } from "../components/AiPolicyPanel";
import { DocHeader } from "../components/DocHeader";
import { ExportPanel } from "../components/ExportPanel";
import { MetadataCard } from "../components/MetadataCard";
import { PermissionsPanel } from "../components/PermissionsPanel";
import { StatusBanner } from "../components/StatusBanner";
import { VersionHistoryPanel } from "../components/VersionHistoryPanel";
import { applyToolbarAction, type ToolbarAction, type ToolbarSelection } from "../lib/richTextToolbar";
import type { ApiClient } from "../services/api";
import { createAiService, type AiSelectionSnapshot } from "../services/ai";
import {
  createRealtimeService,
  type RealtimeConnectionState,
  type RealtimeService,
  type RemotePeer,
} from "../services/realtime";
import { ApiError, type DocumentRole, type GetDocumentResponse, type TextSelection } from "../types/api";

interface DocumentPageProps {
  apiClient: ApiClient;
  userId: string;
}

type SaveState = "saved" | "unsaved" | "saving" | "error";

function mapDocumentError(error: ApiError): string {
  if (error.status === 404) return "Document not found.";
  if (error.status === 401) return "Authentication is required. Refresh and sign in again.";
  if (error.status === 403) return "You no longer have permission to open this document.";
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and refresh.";
  return error.message || "The document could not be loaded.";
}

function mapSaveError(error: unknown): { message: string; stale: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return {
        message: "Your draft is based on an older revision. Reload the latest saved version before saving again.",
        stale: true,
      };
    }

    if (error.status === 403) {
      return {
        message: "You do not have permission to save this document.",
        stale: false,
      };
    }

    if (error.status === 413) {
      return {
        message: error.message || "The document content exceeds the backend size limit.",
        stale: false,
      };
    }

    if (error.code === "NETWORK_ERROR") {
      return {
        message: "Backend unavailable. Start the backend service and try saving again.",
        stale: false,
      };
    }

    return {
      message: error.message || "Could not save this document.",
      stale: false,
    };
  }

  return {
    message: "Could not save this document.",
    stale: false,
  };
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function toRealtimeStatusLabel(state: RealtimeConnectionState, peerCount: number): string {
  if (state === "connected") {
    return peerCount > 0 ? `Live with ${peerCount + 1} participants` : "Live sync connected";
  }

  if (state === "connecting") {
    return "Connecting live sync…";
  }

  if (state === "error") {
    return "Live sync unavailable";
  }

  if (state === "closed") {
    return "Live sync offline";
  }

  return "Live sync idle";
}

/**
 * This page treats the collaborative Yjs document as the live source of text.
 * The REST document snapshot is still critical for permissions, save/version
 * metadata, and recovery paths such as conflicts or revert.
 */
export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [collaborationText, setCollaborationText] = useState("");
  const [fallbackContent, setFallbackContent] = useState("");
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [effectiveRole, setEffectiveRole] = useState<DocumentRole>("viewer");
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [hasStaleRevisionConflict, setHasStaleRevisionConflict] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showPermissionsPanel, setShowPermissionsPanel] = useState(false);
  const [showAiPolicyPanel, setShowAiPolicyPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("idle");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [collaborationReady, setCollaborationReady] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef(0);
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const aiService = createAiService(apiClient, userId);
  const realtimeServiceRef = useRef<RealtimeService | null>(null);

  if (!realtimeServiceRef.current) {
    realtimeServiceRef.current = createRealtimeService(apiClient);
  }

  const visibleContent = collaborationReady ? collaborationText : fallbackContent;

  useEffect(() => {
    realtimeServiceRef.current?.disconnect();
    realtimeServiceRef.current = createRealtimeService(apiClient);

    return () => {
      realtimeServiceRef.current?.disconnect();
    };
  }, [apiClient, documentId]);

  function resetEditorHistory(nextValue: string) {
    historyRef.current = [nextValue];
    historyIndexRef.current = 0;
  }

  function pushEditorHistory(nextValue: string) {
    const currentValue = historyRef.current[historyIndexRef.current];
    if (currentValue === nextValue) {
      return;
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(nextValue);
    if (nextHistory.length > 100) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  }

  function applyVisibleContent(nextValue: string, reason: string, options?: { recordHistory?: boolean }) {
    if (options?.recordHistory) {
      pushEditorHistory(nextValue);
    }

    console.debug("[document-page] content_updated", {
      reason,
      collaborationReady,
      length: nextValue.length,
    });

    if (collaborationReady) {
      const didApply = realtimeServiceRef.current?.applyLocalChange(nextValue);
      if (!didApply) {
        setSaveErrorMessage("This document is currently read-only.");
      }
      return;
    }

    setFallbackContent(nextValue);
  }

  function syncSelection(nextSelection: ToolbarSelection, content: string) {
    setSelection(nextSelection);
    setSelectedText(nextSelection.start === nextSelection.end ? "" : content.slice(nextSelection.start, nextSelection.end));

    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextSelection.start, nextSelection.end);
    });
  }

  async function loadDocument({
    reloadCollaboration = false,
  }: {
    reloadCollaboration?: boolean;
  } = {}) {
    setIsLoading(true);
    setErrorMessage(null);

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
      resetEditorHistory(fetched.content);
      setAccessRevoked(false);
      setEffectiveRole(fetched.role);

      if (reloadCollaboration) {
        realtimeServiceRef.current?.applyRemoteReset(fetched.content);
        setCollaborationText(fetched.content);
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapDocumentError(apiError));
      setDocument(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocument();
  }, [apiClient, documentId, userId]);

  useEffect(() => {
    if (!document) {
      return;
    }

    const realtimeService = realtimeServiceRef.current;
    if (!realtimeService) {
      return;
    }

    setRealtimeError(null);
    setRemotePeers([]);
    setCollaborationReady(false);
    setCollaborationText("");

    void realtimeService.connect(document.documentId, {
      userId,
      role: document.role,
      initialContent: document.content,
      onConnectionStateChange: (nextState) => {
        setRealtimeState(nextState);
        if (nextState === "connected") {
          setCollaborationReady(true);
          setCollaborationText(realtimeService.getText());
        }
      },
      onTextChange: (text) => {
        setCollaborationText(text);
      },
      onPeersChange: (peers) => {
        setRemotePeers(peers);
      },
      onPermissionChange: (role) => {
        setEffectiveRole(role);
      },
      onDocumentReverted: () => {
        setSaveErrorMessage("This document changed remotely. The latest saved version has been reloaded.");
        setHasStaleRevisionConflict(false);
        void loadDocument({ reloadCollaboration: true });
      },
      onAccessRevoked: () => {
        setAccessRevoked(true);
        setEffectiveRole("viewer");
        setSaveErrorMessage("Your access was revoked while this document was open. Editing is now disabled.");
      },
      onError: (message) => setRealtimeError(message),
    });

    return () => {
      realtimeService.disconnect();
      setRemotePeers([]);
    };
  }, [apiClient, document?.documentId, document?.revisionId, userId]);

  useEffect(() => {
    if (!document) {
      return;
    }

    if (saveState === "saving") {
      return;
    }

    const liveText = collaborationReady ? collaborationText : fallbackContent;
    setSaveState(liveText === document.content ? "saved" : "unsaved");
  }, [collaborationReady, collaborationText, fallbackContent, document, saveState]);

  useEffect(() => {
    const activeText = collaborationReady ? collaborationText : fallbackContent;
    const { start, end } = selection;
    if (end > start) {
      setSelectedText(activeText.slice(start, end));
      return;
    }

    setSelectedText("");
  }, [collaborationReady, collaborationText, fallbackContent, selection]);

  function nextRequestId(prefix: string) {
    requestIdRef.current += 1;
    return `${prefix}_${Date.now()}_${requestIdRef.current}`;
  }

  async function reloadLatestDocument() {
    setHasStaleRevisionConflict(false);
    setSaveErrorMessage(null);
    await loadDocument({ reloadCollaboration: true });
  }

  async function handleSave() {
    if (!document || saveState === "saving") {
      return;
    }

    const liveText = realtimeServiceRef.current?.getText() || visibleContent;
    setSaveState("saving");
    setSaveErrorMessage(null);
    setHasStaleRevisionConflict(false);

    try {
      await apiClient.updateDocument(
        documentId,
        { content: liveText, requestId: nextRequestId("save"), baseRevisionId: document.revisionId },
        userId
      );

      await loadDocument();
      setSaveState("saved");
    } catch (error) {
      const mapped = mapSaveError(error);
      setSaveState("error");
      setSaveErrorMessage(mapped.message);
      setHasStaleRevisionConflict(mapped.stale);
    }
  }

  function captureSelection() {
    const ta = textareaRef.current;
    if (!ta) {
      return;
    }

    const nextSelection = {
      start: ta.selectionStart,
      end: ta.selectionEnd,
    };
    setSelection(nextSelection);
    realtimeServiceRef.current?.setCursorSelection(nextSelection.start === nextSelection.end ? null : nextSelection);
  }

  function handleEditorChange(nextText: string) {
    applyVisibleContent(nextText, "typing", { recordHistory: true });
  }

  function handleAiApply(suggestion: string) {
    let nextContent = visibleContent;

    if (collaborationReady) {
      const service = realtimeServiceRef.current;
      if (!service) {
        return;
      }

      const didApply = service.replaceSelection(selection, suggestion);
      if (!didApply) {
        return;
      }

      nextContent = service.getText();
    } else {
      nextContent =
        visibleContent.slice(0, selection.start) + suggestion + visibleContent.slice(selection.end);
      applyVisibleContent(nextContent, "ai-apply", { recordHistory: true });
    }

    const nextCursor = selection.start + suggestion.length;
    syncSelection({ start: nextCursor, end: nextCursor }, nextContent);
  }

  function handleRevert() {
    setSaveErrorMessage(null);
    setHasStaleRevisionConflict(false);
    void loadDocument({ reloadCollaboration: true });
  }

  function buildAiSelectionSnapshot(): AiSelectionSnapshot | null {
    if (!document) {
      return null;
    }

    const { start, end } = selection;
    const activeText = realtimeServiceRef.current?.getText() || visibleContent;
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

  function handleToolbarAction(action: ToolbarAction) {
    if (effectiveRole === "viewer" || accessRevoked) {
      return;
    }

    if (action === "undo" || action === "redo") {
      const nextIndex = historyIndexRef.current + (action === "undo" ? -1 : 1);
      const nextValue = historyRef.current[nextIndex];
      if (nextValue === undefined) {
        return;
      }

      historyIndexRef.current = nextIndex;
      applyVisibleContent(nextValue, `toolbar:${action}`);
      syncSelection({ start: nextValue.length, end: nextValue.length }, nextValue);
      return;
    }

    const textarea = textareaRef.current;
    const currentSelection = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : selection;
    const result = applyToolbarAction(visibleContent, currentSelection, action);
    applyVisibleContent(result.value, `toolbar:${action}`, { recordHistory: true });
    syncSelection(result.selection, result.value);
  }

  const isViewer = effectiveRole === "viewer";
  const isReadOnly = accessRevoked || isViewer;
  const canManagePermissions = effectiveRole === "owner";
  const canManageAiPolicy = effectiveRole === "owner";
  const canRevert = effectiveRole === "owner";
  const collaboratorCount = remotePeers.length;
  const realtimeStatus = toRealtimeStatusLabel(realtimeState, collaboratorCount);

  return (
    <div className="gdoc-shell">
      <DocHeader
        document={document ? { ...document, role: effectiveRole } : null}
        draftTitle={draftTitle}
        canEditTitle={false}
        onTitleChange={setDraftTitle}
        saveState={saveState}
        userId={userId}
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
          </div>
        )}

        {document && (
          <div className="gdoc-page">
            {(isReadOnly || !collaborationReady) && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner
                  tone={isReadOnly ? "warning" : "info"}
                  title={isReadOnly ? "View-only" : "Offline editing"}
                  message={
                    accessRevoked
                      ? "Your access was revoked while this document was open. Refresh or return home."
                      : isViewer
                        ? "You have viewer access — editing is disabled."
                        : "Realtime collaboration is unavailable. You can keep editing locally and save manually."
                  }
                />
              </div>
            )}

            {realtimeError && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner tone="warning" title="Realtime notice" message={realtimeError} />
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

            {remotePeers.length > 0 && (
              <div className="gdoc-collaborator-overlay" aria-label="Live collaborators">
                {remotePeers.map((peer) => (
                  <div key={peer.clientId} className="gdoc-collaborator-chip">
                    <span className="gdoc-collaborator-dot" style={{ backgroundColor: peer.color }} />
                    <span>{peer.userId}</span>
                    {peer.selection && <span className="gdoc-collaborator-meta">editing selection</span>}
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="gdoc-editor"
              value={visibleContent}
              onChange={(event) => handleEditorChange(event.target.value)}
              onSelect={captureSelection}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              readOnly={isReadOnly}
              aria-label="Document content"
              spellCheck
              autoFocus={!isReadOnly}
            />

            {showMeta && (
              <div style={{ marginTop: "2rem", borderTop: "1px solid var(--gd-border)", paddingTop: "1.5rem" }}>
                <MetadataCard document={{ ...document, role: effectiveRole }} />
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
            <span>{visibleContent.length.toLocaleString()} characters</span>
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
