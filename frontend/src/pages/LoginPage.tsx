import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";

import { toAuthError, useAuth } from "../auth/AuthContext";
import { StatusBanner } from "../components/StatusBanner";

function mapLoginError(error: ReturnType<typeof toAuthError>): string {
  if (error.code === "NETWORK_ERROR") {
    return "The backend is unavailable. Start it and try again.";
  }

  return error.message || "Sign-in failed. Please try again.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, authStatus } = useAuth();
  const [identifier, setIdentifier] = useState("user_1");
  const [password, setPassword] = useState("demo-pass");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await login({
        identifier,
        password,
      });
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(mapLoginError(toAuthError(error)));
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Collaborative Editor AI</div>
        <h1>Sign in</h1>
        <p>
          Sign in with a registered account or use one of the current demo identifiers while the
          FastAPI auth contract is still being finalized.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-identifier">Identifier</label>
            <input
              id="login-identifier"
              className="text-input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="user_1"
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="text-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {errorMessage && <StatusBanner tone="error" title="Login failed" message={errorMessage} />}

          <div className="login-quick-actions">
            {["user_1", "user_2", "user_3"].map((candidate) => (
              <button
                key={candidate}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIdentifier(candidate)}
              >
                Use {candidate}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!identifier.trim() || !password.trim() || authStatus === "refreshing"}
          >
            {authStatus === "refreshing" ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer-copy">
          Need an account?{" "}
          <Link to="/register" className="auth-link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
