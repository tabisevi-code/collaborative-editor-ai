import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";

import { StatusBanner } from "../components/StatusBanner";
import { toAuthError, useAuth } from "../auth/AuthContext";

function mapRegisterErrorMessage(error: ReturnType<typeof toAuthError>): string {
  if (error.code === "NETWORK_ERROR") {
    return "The backend is unavailable. Start it and try again.";
  }

  return error.message || "Registration failed. Please try again.";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, authStatus } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextPath = new URLSearchParams(location.search).get("next") || "/";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      await register({
        displayName,
        identifier,
        password,
      });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(mapRegisterErrorMessage(toAuthError(error)));
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Collaborative Editor AI</div>
        <h1>Create account</h1>
        <p>
          Create a real backend account with a hashed password and JWT session.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="register-display-name">Display name</label>
            <input
              id="register-display-name"
              className="text-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ming Ming"
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-identifier">Identifier</label>
            <input
              id="register-identifier"
              className="text-input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="user_4"
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className="text-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Choose a password"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-confirm-password">Confirm password</label>
            <input
              id="register-confirm-password"
              className="text-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
            />
          </div>

          {errorMessage && <StatusBanner tone="error" title="Registration failed" message={errorMessage} />}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!displayName.trim() || !identifier.trim() || !password.trim() || authStatus === "refreshing"}
          >
            {authStatus === "refreshing" ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-footer-copy">
          Already have an account?{" "}
          <Link to={`/login${location.search}`} className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
