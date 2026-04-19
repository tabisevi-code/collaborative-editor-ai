import { useCallback, useEffect, useRef, useState } from "react";

interface UserMenuProps {
  initial: string;
  displayName: string;
  userId: string;
  onSignOut(): void;
}

/**
 * Keep account controls together in one focused surface so the document
 * chrome stays light on the right side while session controls remain easy
 * to discover and edit.
 */
export function UserMenu({ initial, displayName, userId, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  return (
    <div className="gdoc-user-menu" ref={containerRef}>
      <button
        className={`gdoc-user-menu-trigger${open ? " gdoc-user-menu-trigger--open" : ""}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open user menu"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="gdoc-user-avatar">{initial}</div>
        <span className="gdoc-user-menu-label">{userId}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 10l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="gdoc-user-menu-panel" role="dialog" aria-label="User menu">
          <div className="field gdoc-user-menu-field">
            <span className="field-label">Signed in as</span>
            <div className="gdoc-user-menu-summary">
              <strong>{displayName || userId}</strong>
              <span>{userId}</span>
            </div>
          </div>
          <button
            className="btn btn-secondary gdoc-user-menu-signout"
            type="button"
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
