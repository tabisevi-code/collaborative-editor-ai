import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiClient } from "../services/api";
import {
  ApiError,
  type ShareLinkSummary,
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
  const [shareLinks, setShareLinks] = useState<ShareLinkSummary[]>([]);
  const [shareRole, setShareRole] = useState<"editor" | "viewer">("viewer");
  const [shareExpiryHours, setShareExpiryHours] = useState(168);
  const [revokeAccessOnShareRevoke, setRevokeAccessOnShareRevoke] = useState(false);
  const [shareLinkMessage, setShareLinkMessage] = useState<string | null>(null);
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);
  const [savingShareLinkId, setSavingShareLinkId] = useState<string | null>(null);

  function buildShareUrl(shareToken: string): string {
    return `${window.location.origin}/share/${shareToken}`;
  }

  async function loadMembers() {
    setPhase("loading");
    setErrorMessage(null);

    try {
      const [permissionsResponse, shareLinksResponse] = await Promise.all([
        apiClient.listPermissions(documentId, userId),
        apiClient.listShareLinks(documentId, userId),
      ]);
      setMembers(permissionsResponse.members);
      setShareLinks(shareLinksResponse.links);
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
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("Clipboard access is unavailable in this browser. Copy the URL manually.");
    }
  }

  async function handleCreateShareLink() {
    setSavingShareLinkId("creating");
    setErrorMessage(null);
    setShareLinkMessage(null);

    try {
      const response = await apiClient.createShareLink(
        documentId,
        {
          role: shareRole,
          expiresInHours: shareExpiryHours,
          requestId: `req_share_${Date.now()}_${shareRole}_${shareExpiryHours}`,
        },
        userId
      );
      const nextUrl = buildShareUrl(response.shareToken);
      setLatestShareUrl(nextUrl);
      setShareLinkMessage(`Created a ${shareRole} link that expires in ${shareExpiryHours} hours.`);
      await loadMembers();
    } catch (error) {
      setErrorMessage(mapPermissionsError(error));
    } finally {
      setSavingShareLinkId(null);
    }
  }

  async function handleCopyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setShareLinkMessage("Share link copied to clipboard.");
    } catch {
      setErrorMessage("Clipboard access is unavailable in this browser. Copy the share link manually.");
    }
  }

  async function handleRevokeShareLink(linkId: string) {
    setSavingShareLinkId(linkId);
    setErrorMessage(null);

    try {
      const response = await apiClient.revokeShareLink(documentId, linkId, { revokeAccess: revokeAccessOnShareRevoke }, userId);
      if (revokeAccessOnShareRevoke && typeof response.revokedAccessCount === "number") {
        setShareLinkMessage(`Revoked link and removed access from ${response.revokedAccessCount} collaborator(s).`);
      } else {
        setShareLinkMessage("Share link revoked.");
      }
      if (latestShareUrl && shareLinks.some((link) => link.linkId === linkId)) {
        setLatestShareUrl(null);
      }
      await loadMembers();
    } catch (error) {
      setErrorMessage(mapPermissionsError(error));
    } finally {
      setSavingShareLinkId(null);
    }
  }

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel" data-testid="permissions-panel">
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
            <p className="field-hint">Copy this direct document URL when the recipient already has access, or use invite links below to grant revocable access by link.</p>
            <button className="btn btn-secondary" onClick={() => void handleCopyLink()}>
              {copied ? "Copied!" : "Copy document link"}
            </button>
          </div>

          <div className="field panel">
            <div className="panel-header">
              <h2>Invite links</h2>
            </div>
            <p className="field-hint">
              Create revocable editor or viewer links. Recipients sign in, accept the link, and get the selected role.
            </p>

            <div className="metadata-grid" style={{ marginBottom: "1rem" }}>
              <div>
                <label className="field-label" htmlFor="share-link-role">Role</label>
                <select
                  id="share-link-role"
                  data-testid="share-link-role"
                  className="text-input"
                  value={shareRole}
                  onChange={(event) => setShareRole(event.target.value as "editor" | "viewer")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="share-link-expiry">Expiry (hours)</label>
                <select
                  id="share-link-expiry"
                  data-testid="share-link-expiry"
                  className="text-input"
                  value={shareExpiryHours}
                  onChange={(event) => setShareExpiryHours(Number(event.target.value))}
                >
                  <option value={24}>24 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary" data-testid="share-link-create" onClick={() => void handleCreateShareLink()} disabled={savingShareLinkId !== null}>
                {savingShareLinkId === "creating" ? "Creating…" : "Create share link"}
              </button>
              {latestShareUrl && (
                <button className="btn btn-secondary" data-testid="share-link-copy-latest" onClick={() => void handleCopyShareLink(latestShareUrl)}>
                  Copy latest share link
                </button>
              )}
            </div>

            <label className="field permission-toggle" style={{ marginTop: "1rem" }}>
              <span className="field-label">Revoke granted access when revoking a link</span>
              <input
                type="checkbox"
                data-testid="share-link-revoke-access-toggle"
                checked={revokeAccessOnShareRevoke}
                onChange={(event) => setRevokeAccessOnShareRevoke(event.target.checked)}
              />
            </label>
            <p className="field-hint">
              If enabled, collaborators whose current access came from that share link will also lose access.
            </p>

            {shareLinkMessage && (
              <div className="status-banner status-success" style={{ marginTop: "1rem" }}>
                <strong>Share link ready</strong>
                <p>{shareLinkMessage}</p>
                {latestShareUrl && <p style={{ wordBreak: "break-all" }}>{latestShareUrl}</p>}
              </div>
            )}

            <div className="field" style={{ marginTop: "1rem" }}>
              <p className="field-label">Active and past links</p>
              {phase === "loading" && <p className="field-hint">Loading share links…</p>}
              {phase === "loaded" && shareLinks.length === 0 && <p className="field-hint">No share links created yet.</p>}
              {phase === "loaded" && shareLinks.length > 0 && (
                <div className="version-list">
                  {shareLinks.map((link) => {
                    const isBusy = savingShareLinkId === link.linkId;
                    return (
                      <div key={link.linkId} className="version-item" data-testid={`share-link-item-${link.linkId}`}>
                        <div className="version-meta">
                          <div className="version-label">{link.role} link</div>
                          <div className="version-detail">
                            Expires {new Date(link.expiresAt).toLocaleString()}
                            {link.lastClaimedAt ? ` · last claimed ${new Date(link.lastClaimedAt).toLocaleString()}` : ""}
                          </div>
                          <div style={{ marginTop: "0.3rem" }}>
                            <span className="version-reason">{link.active ? "active" : "revoked / expired"}</span>
                          </div>
                        </div>
                        {link.active && (
                          <button
                            className="btn btn-danger btn-sm"
                            data-testid={`share-link-revoke-${link.linkId}`}
                            onClick={() => void handleRevokeShareLink(link.linkId)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
