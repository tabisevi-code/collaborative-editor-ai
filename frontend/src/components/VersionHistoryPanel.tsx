import { useEffect, useState } from "react";
import type { VersionSummary } from "../types/api";
import { ApiError } from "../types/api";
import type { ApiClient } from "../services/api";
import { toPlainText } from "../pages/documentPageUtils";

interface VersionHistoryPanelProps {
  documentId: string;
  userId: string;
  apiClient: ApiClient;
  canRevert: boolean;
  onRevert(versionId: string): void;
  onClose(): void;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function VersionHistoryPanel({
  documentId,
  userId,
  apiClient,
  canRevert,
  onRevert,
  onClose,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [phase, setPhase] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase("loading");
      try {
        const data = await apiClient.listVersions(documentId, userId);
        if (!cancelled) {
          setVersions(data.versions);
          setSelectedVersionId((current) => current || data.versions[0]?.versionId || null);
          setPhase("loaded");
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            setErrorMessage("Version history is not yet available on this backend.");
          } else {
            setErrorMessage("Could not load version history.");
          }
          setPhase("error");
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [apiClient, documentId, userId]);

  async function handleRevert(versionId: string) {
    setRevertingId(versionId);
    try {
      await apiClient.revertToVersion(
        documentId,
        {
          requestId: `req_revert_${Date.now()}_${versionId}`,
          targetVersionId: versionId,
        },
        userId
      );
      onRevert(versionId);
      onClose();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Revert failed.";
      setErrorMessage(msg);
    } finally {
      setRevertingId(null);
    }
  }

  const selectedVersion = versions.find((version) => version.versionId === selectedVersionId) || versions[0] || null;
  const selectedPreview = selectedVersion?.snapshotContent ? toPlainText(selectedVersion.snapshotContent).trim() : "";

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel" data-testid="version-history-panel">
        <div className="side-panel-header">
          <h3>
            <span>🕓</span>
            Version History
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="side-panel-body">
          {errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>Error</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {phase === "loading" && (
            <div className="ai-spinner">
              <div className="spinner-ring" style={{ borderTopColor: "var(--color-primary)", borderColor: "var(--color-border)" }} />
              <span>Loading versions…</span>
            </div>
          )}

          {phase === "loaded" && versions.length === 0 && (
            <p className="field-hint" style={{ textAlign: "center", padding: "2rem 0" }}>
              No versions found for this document.
            </p>
          )}

          {phase === "loaded" && versions.length > 0 && (
            <div className="stack" style={{ gap: "1rem" }}>
              <div className="version-list">
                {versions.map((v) => {
                  const isSelected = v.versionId === (selectedVersion?.versionId || null);
                  return (
                    <div
                      key={v.versionId}
                      className="version-item"
                      data-testid={`version-item-${v.versionId}`}
                      role="button"
                      tabIndex={0}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderColor: isSelected ? "var(--color-primary)" : undefined,
                        boxShadow: isSelected ? "0 0 0 1px var(--color-primary) inset" : undefined,
                      }}
                      onClick={() => setSelectedVersionId(v.versionId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedVersionId(v.versionId);
                        }
                      }}
                    >
                      <div className="version-meta">
                        <div className="version-label">Version {v.versionNumber}</div>
                        <div className="version-detail">
                          {formatDate(v.createdAt)} · {v.createdBy}
                        </div>
                        <div style={{ marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span className="version-reason">{v.reason}</span>
                          {isSelected && <span className="field-hint">Previewing</span>}
                        </div>
                      </div>
                      {canRevert && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          data-testid={`revert-version-${v.versionId}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRevert(v.versionId);
                          }}
                          disabled={revertingId === v.versionId}
                        >
                          {revertingId === v.versionId ? "Reverting…" : "Revert"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedVersion && (
                <div className="panel" aria-label="Version preview" data-testid="version-preview-panel">
                  <div className="panel-header">
                    <h2>Preview Version {selectedVersion.versionNumber}</h2>
                  </div>
                  <div className="metadata-grid" style={{ marginBottom: "1rem" }}>
                    <div>
                      <dt>Saved</dt>
                      <dd>{formatDate(selectedVersion.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Author</dt>
                      <dd>{selectedVersion.createdBy}</dd>
                    </div>
                    <div>
                      <dt>Reason</dt>
                      <dd>{selectedVersion.reason}</dd>
                    </div>
                  </div>
                  <div className="ai-selection-preview" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
                    {selectedPreview || "No snapshot preview is available for this version."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="side-panel-footer">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
