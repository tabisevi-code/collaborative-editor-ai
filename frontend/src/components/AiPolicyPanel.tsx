import { useEffect, useState } from "react";

import type { ApiClient } from "../services/api";
import { ApiError, type AiPolicyResponse, type AiUsageResponse, type DocumentRole } from "../types/api";

interface AiPolicyPanelProps {
  documentId: string;
  userId: string;
  apiClient: ApiClient;
  onClose(): void;
}

const ROLE_OPTIONS: DocumentRole[] = ["owner", "editor", "viewer"];

function mapAiPolicyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend and try again.";
    return error.message || "AI policy update failed.";
  }

  return "AI policy update failed.";
}

export function AiPolicyPanel({ documentId, userId, apiClient, onClose }: AiPolicyPanelProps) {
  const [policy, setPolicy] = useState<AiPolicyResponse | null>(null);
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadPolicy() {
    setPhase("loading");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const [nextPolicy, nextUsage] = await Promise.all([
        apiClient.getAiPolicy(documentId, userId),
        apiClient.getAiUsage(documentId, userId),
      ]);
      setPolicy(nextPolicy);
      setUsage(nextUsage);
      setPhase("loaded");
    } catch (error) {
      setErrorMessage(mapAiPolicyError(error));
      setPhase("error");
    }
  }

  useEffect(() => {
    void loadPolicy();
  }, [apiClient, documentId, userId]);

  function toggleAllowedRole(role: DocumentRole) {
    setPolicy((current) => {
      if (!current) {
        return current;
      }

      const allowedRoles = current.allowedRolesForAI.includes(role)
        ? current.allowedRolesForAI.filter((item) => item !== role)
        : [...current.allowedRolesForAI, role];

      return {
        ...current,
        allowedRolesForAI: ROLE_OPTIONS.filter((item) => allowedRoles.includes(item)),
      };
    });
  }

  async function handleSave() {
    if (!policy) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const saved = await apiClient.updateAiPolicy(
        documentId,
        {
          aiEnabled: policy.aiEnabled,
          allowedRolesForAI: policy.allowedRolesForAI,
          dailyQuota: policy.dailyQuota,
        },
        userId
      );
      setPolicy(saved);
      setUsage(await apiClient.getAiUsage(documentId, userId));
      setSuccessMessage("AI policy saved.");
    } catch (error) {
      setErrorMessage(mapAiPolicyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel">
        <div className="side-panel-header">
          <h3>
            <span>⚙️</span>
            AI Policy
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="side-panel-body">
          {errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>AI policy request failed</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="status-banner status-success" role="status">
              <strong>AI policy updated</strong>
              <p>{successMessage}</p>
            </div>
          )}

          {phase === "loading" && <p className="field-hint">Loading AI policy…</p>}

          {policy && (
            <>
              <label className="field permission-toggle">
                <span className="field-label">AI enabled</span>
                <input
                  type="checkbox"
                  checked={policy.aiEnabled}
                  onChange={(event) =>
                    setPolicy((current) => (current ? { ...current, aiEnabled: event.target.checked } : current))
                  }
                />
              </label>

              <div className="field">
                <p className="field-label">Allowed roles</p>
                <div className="role-chip-row">
                  {ROLE_OPTIONS.map((role) => {
                    const active = policy.allowedRolesForAI.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        className={`role-filter-chip${active ? " active" : ""}`}
                        onClick={() => toggleAllowedRole(role)}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
                <p className="field-hint">At least one role must remain allowed.</p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="daily-quota">
                  Daily quota
                </label>
                <input
                  id="daily-quota"
                  type="number"
                  min={1}
                  className="text-input"
                  value={policy.dailyQuota}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current
                        ? { ...current, dailyQuota: Math.max(1, Number(event.target.value) || 1) }
                        : current
                    )
                  }
                />
                {usage && (
                  <p className="field-hint">
                    Current usage: {usage.usedToday}/{usage.dailyQuota} used today · {usage.remainingToday} remaining
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="side-panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => void handleSave()}
            disabled={!policy || policy.allowedRolesForAI.length === 0 || isSaving}
          >
            {isSaving ? "Saving…" : "Save policy"}
          </button>
        </div>
      </aside>
    </>
  );
}
