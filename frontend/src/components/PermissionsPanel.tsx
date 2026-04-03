import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiClient } from "../services/api";
import {
  ApiError,
  type DocumentPermissionMember,
  type UpdatePermissionRequest,
} from "../types/api";

interface PermissionsPanelProps {
  documentId: string;
  userId: string;
  apiClient: ApiClient;
  ownerId?: string;
  onClose(): void;
}

function mapPermissionsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend and try again.";
    return error.message || "Permission request failed.";
  }

  return "Permission request failed.";
}

/**
 * Sharing is owner-only in the backend, so the panel mirrors that model and
 * keeps all member management in one place.
 */
export function PermissionsPanel({
  documentId,
  userId,
  apiClient,
  ownerId,
  onClose,
}: PermissionsPanelProps) {
  const [members, setMembers] = useState<DocumentPermissionMember[]>([]);
  const [phase, setPhase] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [savingTargetUserId, setSavingTargetUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadMembers() {
    setPhase("loading");
    setErrorMessage(null);

    try {
      const response = await apiClient.listPermissions(documentId, userId);
      setMembers(response.members);
      setPhase("loaded");
    } catch (error) {
      setErrorMessage(mapPermissionsError(error));
      setPhase("error");
    }
  }

  useEffect(() => {
    void loadMembers();
  }, [apiClient, documentId, userId]);

  const existingMember = useMemo(
    () => members.find((member) => member.userId === targetUserId.trim()),
    [members, targetUserId]
  );

  async function handleUpsertPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUserId = targetUserId.trim();
    if (!normalizedUserId) {
      setErrorMessage("Target user ID is required.");
      return;
    }

    const payload: UpdatePermissionRequest = {
      requestId: `req_perm_${Date.now()}_${normalizedUserId}`,
      targetUserId: normalizedUserId,
      role,
    };

    setSavingTargetUserId(normalizedUserId);
    setErrorMessage(null);

    try {
      await apiClient.updatePermission(documentId, payload, userId);
      setTargetUserId("");
      await loadMembers();
    } catch (error) {
      setErrorMessage(mapPermissionsError(error));
    } finally {
      setSavingTargetUserId(null);
    }
  }

  async function handleRevokePermission(targetId: string) {
    setSavingTargetUserId(targetId);
    setErrorMessage(null);

    try {
      await apiClient.revokePermission(documentId, targetId, userId);
      await loadMembers();
    } catch (error) {
      setErrorMessage(mapPermissionsError(error));
    } finally {
      setSavingTargetUserId(null);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel">
        <div className="side-panel-header">
          <h3>
            <span>👥</span>
            Permissions
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="side-panel-body">
          <p className="field-hint">
            Owners can grant editor or viewer access. The current owner remains protected.
          </p>

          <div className="field">
            <p className="field-label">Share link</p>
            <p className="field-hint">Copy this link and send it to colleagues. They still need access granted below.</p>
            <button className="btn btn-secondary" onClick={() => void handleCopyLink()}>
              {copied ? "Copied!" : "Copy document link"}
            </button>
          </div>

          {errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>Permission update failed</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          <form className="field" onSubmit={handleUpsertPermission}>
            <label className="field-label" htmlFor="permissions-user-id">
              Collaborator user ID
            </label>
            <input
              id="permissions-user-id"
              className="text-input"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder="user_2"
              spellCheck={false}
            />

            <label className="field-label" htmlFor="permissions-role">
              Role
            </label>
            <select
              id="permissions-role"
              className="text-input"
              value={role}
              onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>

            <p className="field-hint">
              {existingMember
                ? `This will update ${existingMember.userId} from ${existingMember.role} to ${role}.`
                : "This will add or update the selected collaborator."}
            </p>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={!targetUserId.trim() || savingTargetUserId !== null}
            >
              {existingMember ? "Update access" : "Grant access"}
            </button>
          </form>

          <div className="field">
            <p className="field-label">Current members</p>

            {phase === "loading" && <p className="field-hint">Loading collaborators…</p>}
            {phase === "loaded" && members.length === 0 && (
              <p className="field-hint">No collaborators have access to this document.</p>
            )}

            {phase === "loaded" && members.length > 0 && (
              <div className="version-list">
                {members.map((member) => {
                  const isOwner = member.role === "owner" || member.userId === ownerId;
                  const isBusy = savingTargetUserId === member.userId;
                  return (
                    <div key={member.userId} className="version-item">
                      <div className="version-meta">
                        <div className="version-label">{member.userId}</div>
                        <div className="version-detail">
                          {member.role} access
                          {isOwner ? " · owner" : ""}
                        </div>
                      </div>
                      {!isOwner && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void handleRevokePermission(member.userId)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
