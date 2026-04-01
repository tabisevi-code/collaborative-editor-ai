import { Link } from "react-router-dom";

interface AppBarProps {
  userId: string;
  onUserIdChange(nextValue: string): void;
}

export function AppBar({ userId, onUserIdChange }: AppBarProps) {
  const initial = userId.charAt(0).toUpperCase() || "U";

  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand">
        <div className="topbar-logo">CE</div>
        <span className="topbar-title">Collaborative Editor</span>
      </Link>

      <div className="topbar-actions">
        <label className="user-chip" title="Active user ID — change to switch roles">
          <div className="user-avatar">{initial}</div>
          <input
            value={userId}
            onChange={(e) => onUserIdChange(e.target.value)}
            placeholder="user_1"
            aria-label="User ID"
            spellCheck={false}
          />
        </label>
      </div>
    </header>
  );
}
