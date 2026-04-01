import { useEffect, useState } from "react";
import type { VersionSummary } from "../types/api";
import { ApiError } from "../types/api";
import type { ApiClient } from "../services/api";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase("loading");
      try {
        const data = await apiClient.listVersions(documentId, userId);
        if (!cancelled) {
          setVersions(data.versions);
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
      await apiClient.revertToVersion(documentId, versionId, userId);
      onRevert(versionId);
      onClose();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Revert failed.";
      setErrorMessage(msg);
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel">
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
            <div className="version-list">
              {versions.map((v) => (
                <div key={v.versionId} className="version-item">
                  <div className="version-meta">
                    <div className="version-label">Version {v.versionNumber}</div>
                    <div className="version-detail">
                      {formatDate(v.createdAt)} · {v.createdBy}
                    </div>
                    <div style={{ marginTop: "0.3rem" }}>
                      <span className="version-reason">{v.reason}</span>
                    </div>
                  </div>
                  {canRevert && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRevert(v.versionId)}
                      disabled={revertingId === v.versionId}
                    >
                      {revertingId === v.versionId ? "Reverting…" : "Revert"}
                    </button>
                  )}
                </div>
              ))}
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
