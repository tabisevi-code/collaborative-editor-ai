import { Link } from "react-router-dom";
import { useMemo, useState, type FormEvent } from "react";

import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError } from "../types/api";

interface ForgotPasswordPageProps {
  apiClient: ApiClient;
}

const IDENTIFIER_REGEX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

function mapAuthUtilityError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") {
      return "The backend is unavailable. Start it and try again.";
    }
    return error.message || "Password reset request failed.";
  }

  return "Password reset request failed.";
}

export function ForgotPasswordPage({ apiClient }: ForgotPasswordPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phase, setPhase] = useState<"idle" | "requesting" | "resetting" | "done">("idle");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRequestToken = useMemo(() => IDENTIFIER_REGEX.test(identifier.trim()), [identifier]);

  async function handleRequestResetToken(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setPhase("requesting");

    try {
      const response = await apiClient.forgotPassword({ identifier: identifier.trim() });
      setResetToken(response.resetToken || "");
      setExpiresAt(response.expiresAt);
      setInfoMessage(response.message);
      setPhase("idle");
    } catch (error) {
      setErrorMessage(mapAuthUtilityError(error));
      setPhase("idle");
    }
  }

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setPhase("resetting");
    try {
      await apiClient.resetPassword({
        identifier: identifier.trim(),
        resetToken: resetToken.trim(),
        newPassword,
      });
      setPhase("done");
      setInfoMessage("Password reset complete. You can now sign in with the new password.");
    } catch (error) {
      setErrorMessage(mapAuthUtilityError(error));
      setPhase("idle");
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Collaborative Editor AI</div>
        <h1>Forgot password</h1>
        <p>
          In this local coursework build, the one-time reset token is shown directly instead of being emailed.
        </p>

        <form onSubmit={handleRequestResetToken} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="forgot-identifier">Identifier</label>
            <input
              id="forgot-identifier"
              className="text-input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="user_1"
              autoFocus
              spellCheck={false}
            />
          </div>

          <button type="submit" className="btn btn-secondary" disabled={!canRequestToken || phase === "requesting"}>
            {phase === "requesting" ? "Issuing token..." : "Get reset token"}
          </button>
        </form>

        {infoMessage && <StatusBanner tone="info" title="Reset token status" message={infoMessage} />}
        {errorMessage && <StatusBanner tone="error" title="Reset failed" message={errorMessage} />}

        {resetToken && (
          <div className="panel">
            <div className="panel-header">
              <h2>One-time reset token</h2>
            </div>
            <div className="field">
              <textarea className="text-input" value={resetToken} readOnly style={{ minHeight: 96, resize: "vertical" }} />
              <p className="field-hint">
                Copy this token into the reset form below. {expiresAt ? `It expires at ${new Date(expiresAt).toLocaleString()}.` : ""}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="forgot-reset-token">Reset token</label>
            <input
              id="forgot-reset-token"
              className="text-input"
              value={resetToken}
              onChange={(event) => setResetToken(event.target.value)}
              placeholder="Paste the one-time reset token"
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="forgot-new-password">New password</label>
            <input
              id="forgot-new-password"
              className="text-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Choose a new password"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="forgot-confirm-password">Confirm new password</label>
            <input
              id="forgot-confirm-password"
              className="text-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canRequestToken || !resetToken.trim() || !newPassword.trim() || phase === "resetting"}
          >
            {phase === "resetting" ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        <p className="auth-footer-copy">
          Remembered it? <Link to="/login" className="auth-link">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
