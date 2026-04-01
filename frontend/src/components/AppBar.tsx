interface AppBarProps {
  apiBaseUrl: string;
  userId: string;
  onUserIdChange(nextValue: string): void;
}

/**
 * The top bar exposes the active backend target and user identity so demos can
 * switch between owner/viewer roles without touching code or devtools.
 */
export function AppBar({ apiBaseUrl, userId, onUserIdChange }: AppBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Frontend PoC</p>
        <h1>Collaborative Editor AI</h1>
      </div>
      <div className="topbar-meta">
        <div className="topbar-chip">
          <span className="chip-label">API Base URL</span>
          <span className="chip-value">{apiBaseUrl}</span>
        </div>
        <label className="user-field">
          <span className="chip-label">User ID</span>
          <input
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="user_1"
            aria-label="User ID"
          />
        </label>
      </div>
    </header>
  );
}
