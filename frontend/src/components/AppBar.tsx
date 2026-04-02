/** Google Docs-style home top bar */
interface AppBarProps {
  userId: string;
  onUserIdChange(nextValue: string): void;
  onSignOut(): void;
}

export function AppBar({ userId, onUserIdChange, onSignOut }: AppBarProps) {
  const initial = userId.charAt(0).toUpperCase() || "U";

  return (
    <header className="home-topbar">
      {/* Brand */}
      <div className="home-topbar-logo">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <rect width="40" height="40" rx="4" fill="#4285f4"/>
          <rect x="9" y="9" width="22" height="28" rx="2" fill="white" opacity="0.9"/>
          <rect x="12" y="6" width="13" height="4" rx="1" fill="#a8c7fa"/>
          <path d="M25 6l6 6h-6V6z" fill="#4285f4"/>
          <rect x="13" y="16" width="14" height="1.5" rx="0.75" fill="#dadce0"/>
          <rect x="13" y="20" width="14" height="1.5" rx="0.75" fill="#dadce0"/>
          <rect x="13" y="24" width="9"  height="1.5" rx="0.75" fill="#dadce0"/>
        </svg>
        <span className="home-topbar-logo-text">Docs</span>
      </div>

      {/* Search */}
      <div className="home-search-wrap">
        <span className="home-search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input className="home-search-input" placeholder="Search" aria-label="Search documents" />
      </div>

      {/* Right: user switcher + avatar */}
      <div className="home-topbar-right">
        <label className="user-switch-chip" title="Active user ID — change to switch roles">
          <div className="home-user-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{initial}</div>
          <input
            value={userId}
            onChange={(e) => onUserIdChange(e.target.value)}
            placeholder="user_1"
            aria-label="User ID"
            spellCheck={false}
          />
        </label>
        <button className="btn btn-secondary btn-sm" onClick={onSignOut}>
          Sign out
        </button>
        <button className="gd-icon-btn" title="Google apps">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="6"  cy="6"  r="2"/><circle cx="12" cy="6"  r="2"/><circle cx="18" cy="6"  r="2"/>
            <circle cx="6"  cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>
            <circle cx="6"  cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
          </svg>
        </button>
        <div className="home-user-avatar" title={`Signed in as ${userId}`}>{initial}</div>
      </div>
    </header>
  );
}
