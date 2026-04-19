import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError, type ShareLinkPreviewResponse } from "../types/api";

interface ShareLinkPageProps {
  apiClient: ApiClient;
}

function mapShareLinkError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "LINK_REVOKED") return "This share link was revoked by the owner.";
    if (error.code === "LINK_EXPIRED") return "This share link has expired.";
    return error.message || "Could not load this share link.";
  }
  return "Could not load this share link.";
}

export function ShareLinkPage({ apiClient }: ShareLinkPageProps) {
  const { shareToken = "" } = useParams();
  const navigate = useNavigate();
  const { session, authStatus } = useAuth();
  const [preview, setPreview] = useState<ShareLinkPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "accepting" | "accepted" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPhase("loading");
      setErrorMessage(null);
      try {
        const response = await apiClient.previewShareLink(shareToken);
        if (!cancelled) {
          setPreview(response);
          setPhase("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(mapShareLinkError(error));
          setPhase("error");
        }
      }
    }

    if (shareToken) {
      void loadPreview();
    } else {
      setErrorMessage("This share link is invalid.");
      setPhase("error");
    }

    return () => {
      cancelled = true;
    };
  }, [apiClient, shareToken]);

  const nextQuery = useMemo(() => `?next=${encodeURIComponent(`/share/${shareToken}`)}`, [shareToken]);

  async function handleAccept() {
    setPhase("accepting");
    setErrorMessage(null);
    try {
      const response = await apiClient.acceptShareLink(shareToken);
      setPhase("accepted");
      navigate(`/documents/${encodeURIComponent(response.documentId)}`, { replace: true });
    } catch (error) {
      setErrorMessage(mapShareLinkError(error));
      setPhase("error");
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Collaborative Editor AI</div>
        <h1>Open shared document</h1>
        <p>
          Review the invite below, then sign in and accept access to open the document in your workspace.
        </p>

        {phase === "loading" && <StatusBanner tone="info" title="Loading share link" message="Checking the invite details." />}
        {errorMessage && <StatusBanner tone="error" title="Share link unavailable" message={errorMessage} />}

        {preview && (
          <div className="panel">
            <div className="panel-header">
              <h2>{preview.documentTitle}</h2>
            </div>
            <div className="metadata-grid">
              <div>
                <dt>Access</dt>
                <dd>{preview.role}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{preview.ownerDisplayName || "Unknown"}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{new Date(preview.expiresAt).toLocaleString()}</dd>
              </div>
            </div>
          </div>
        )}

        {!session && phase !== "loading" && (
          <div className="stack" style={{ gap: "0.75rem" }}>
            <Link className="btn btn-primary" to={`/login${nextQuery}`}>
              Sign in to accept link
            </Link>
            <Link className="btn btn-secondary" to={`/register${nextQuery}`}>
              Create account and accept link
            </Link>
          </div>
        )}

        {session && preview && (
          <div className="stack" style={{ gap: "0.75rem" }}>
            <StatusBanner
              tone="info"
              title={`Signed in as ${session.user.displayName}`}
              message="Accept this link to open the shared document with the granted role."
            />
            <button className="btn btn-primary" onClick={() => void handleAccept()} disabled={phase === "accepting"}>
              {phase === "accepting" ? "Accepting…" : `Accept ${preview.role} access`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
