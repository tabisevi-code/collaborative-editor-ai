import { useState, type FormEvent } from "react";

import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError } from "../types/api";

interface LoginPageProps {
  apiClient: ApiClient;
  onAuthenticated(userId: string): void;
}

function mapLoginError(error: ApiError): string {
  if (error.code === "NETWORK_ERROR") {
    return "Backend unavailable. Start the backend service and try again.";
  }

  return error.message || "Sign-in failed. Please try again.";
}

export function LoginPage({ apiClient, onAuthenticated }: LoginPageProps) {
  const [userId, setUserId] = useState("user_1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await apiClient.login(userId);
      onAuthenticated(session.userId);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapLoginError(apiError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Collaborative Editor AI</div>
        <h1>Sign in</h1>
        <p>
          This MVP uses local bearer-token authentication. Sign in as <code>user_1</code>, <code>user_2</code>, or another user ID to open the system.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-user-id">User ID</label>
            <input
              id="login-user-id"
              className="text-input"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="user_1"
              autoFocus
              spellCheck={false}
            />
          </div>

          {errorMessage && <StatusBanner tone="error" title="Login failed" message={errorMessage} />}

          <div className="login-quick-actions">
            {["user_1", "user_2", "user_3"].map((candidate) => (
              <button
                key={candidate}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setUserId(candidate)}
              >
                Use {candidate}
              </button>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" disabled={!userId.trim() || isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
