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
import type { ApiClient } from "../services/api";
import { createAiService, type AiSelectionSnapshot } from "../services/ai";
import { createRealtimeService, type RealtimeConnectionState, type RealtimeService } from "../services/realtime";
import { ApiError, type GetDocumentResponse, type TextSelection } from "../types/api";

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
        message: "Your draft is based on an older revision. Reload the latest version before saving again.",
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
 * The document page is the integration hub for the current backend. It owns
 * save conflict handling, AI snapshots, management panels, and realtime state.
 */
export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
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
  const [selectedText, setSelectedText] = useState("");
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("idle");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [presentUsers, setPresentUsers] = useState<string[]>([]);
  const [accessRevoked, setAccessRevoked] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef(0);
  const aiService = createAiService(apiClient, userId);
  const realtimeServiceRef = useRef<RealtimeService | null>(null);

  if (!realtimeServiceRef.current) {
    realtimeServiceRef.current = createRealtimeService(apiClient);
  }

  async function loadDocument({ preserveDraft = false }: { preserveDraft?: boolean } = {}) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const fetched = await apiClient.getDocument(documentId, userId);
      setDocument(fetched);
      setDraftTitle(fetched.title);
      setAccessRevoked(false);

      if (!preserveDraft) {
        setDraftContent(fetched.content);
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

    setSaveState((current) => {
      if (current === "saving") {
        return current;
      }

      const dirty = draftContent !== document.content;
      return dirty ? "unsaved" : "saved";
    });
  }, [draftContent, draftTitle, document]);

  useEffect(() => {
    if (!document) {
      return;
    }

    const realtimeService = realtimeServiceRef.current;
    if (!realtimeService) {
      return;
    }

    setRealtimeError(null);
    setPresentUsers([]);

    void realtimeService.connect(document.documentId, {
      userId,
      onConnectionStateChange: (nextState) => setRealtimeState(nextState),
      onSessionReady: (payload) => {
        setRealtimeError(null);
        setPresentUsers((current) => (current.includes(payload.userId) ? current : [...current, payload.userId]));
      },
      onPresenceJoin: (payload) => {
        setPresentUsers((current) => (current.includes(payload.userId) ? current : [...current, payload.userId]));
      },
      onPresenceLeave: (payload) => {
        setPresentUsers((current) => current.filter((item) => item !== payload.userId));
      },
      onPermissionUpdated: () => {
        void loadDocument({ preserveDraft: true });
      },
      onDocumentReverted: () => {
        setSaveErrorMessage("This document changed remotely. The latest version has been reloaded.");
        void loadDocument();
      },
      onAccessRevoked: () => {
        setAccessRevoked(true);
        setSaveErrorMessage("Your access was revoked while this document was open. Editing is now disabled.");
      },
      onError: (message) => setRealtimeError(message),
    });

    return () => {
      realtimeService.disconnect();
      setPresentUsers([]);
    };
  }, [apiClient, document?.documentId, userId]);

  async function reloadLatestDocument() {
    setHasStaleRevisionConflict(false);
    setSaveErrorMessage(null);
    await loadDocument();
  }

  async function handleSave() {
    if (!document || saveState === "saving") return;

    setSaveState("saving");
    setSaveErrorMessage(null);
    setHasStaleRevisionConflict(false);
    requestIdRef.current += 1;
    const requestId = `req_${Date.now()}_${requestIdRef.current}`;

    try {
      await apiClient.updateDocument(
        documentId,
        { content: draftContent, requestId, baseRevisionId: document.revisionId },
        userId
      );

      await loadDocument({ preserveDraft: true });
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
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    setSelection({ start, end });

    realtimeServiceRef.current?.sendPresence({
      cursor: end,
      selection: start === end ? null : { start, end },
    });

    if (start !== end) {
      setSelectedText(draftContent.slice(start, end));
      return;
    }

    setSelectedText("");
  }

  function handleAiApply(suggestion: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraftContent((prev) => prev + "\n\n" + suggestion);
      return;
    }

    const { selectionStart: start, selectionEnd: end } = ta;
    setDraftContent(draftContent.slice(0, start) + suggestion + draftContent.slice(end));
  }

  function handleRevert() {
    void loadDocument();
    setSaveErrorMessage(null);
    setHasStaleRevisionConflict(false);
  }

  function buildAiSelectionSnapshot(): AiSelectionSnapshot | null {
    if (!document) return null;

    const { start, end } = selection;
    if (end <= start) return null;

    return {
      selection,
      selectedText: draftContent.slice(start, end),
      contextBefore: draftContent.slice(Math.max(0, start - 120), start),
      contextAfter: draftContent.slice(end, Math.min(draftContent.length, end + 120)),
      baseVersionId: document.currentVersionId,
    };
  }

  const isViewer = document?.role === "viewer";
  const isReadOnly = accessRevoked || isViewer;
  const canManagePermissions = document?.role === "owner";
  const canManageAiPolicy = document?.role === "owner";
  const canRevert = document?.role === "owner";
  const collaboratorCount = presentUsers.filter((item) => item !== userId).length;
  const realtimeStatus = toRealtimeStatusLabel(realtimeState, collaboratorCount);

  return (
    <div className="gdoc-shell">
      <DocHeader
        document={document}
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
            {isReadOnly && (
              <div style={{ marginBottom: "1rem" }}>
                <StatusBanner
                  tone="warning"
                  title="View-only"
                  message={
                    accessRevoked
                      ? "Your access was revoked while this document was open. Refresh or return home."
                      : "You have viewer access — editing is disabled."
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
                      Reload latest version
                    </button>
                  </div>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="gdoc-editor"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
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

      <footer className="gdoc-statusbar">
        {document && (
          <>
            <button className="gdoc-statusbar-btn" onClick={() => setShowMeta((value) => !value)}>
              {showMeta ? "Hide" : "Info"}
            </button>
            <span>·</span>
            <span>{wordCount(draftContent).toLocaleString()} words</span>
            <span>·</span>
            <span>{draftContent.length.toLocaleString()} characters</span>
            <span>·</span>
            <span>{collaboratorCount > 0 ? `${collaboratorCount + 1} people connected` : "Only you connected"}</span>
            {document.updatedAt && (
              <>
                <span>·</span>
                <span>
                  Last updated{" "}
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
