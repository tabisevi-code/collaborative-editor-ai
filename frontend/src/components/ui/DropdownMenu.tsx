import { useState, useRef, useEffect, useCallback } from "react";

export interface MenuSeparator {
  type: "separator";
}

export interface MenuItem {
  type?: "item";
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

export type MenuEntry = MenuItem | MenuSeparator;

interface DropdownMenuProps {
  label: string;
  items: MenuEntry[];
  disabled?: boolean;
}

export function DropdownMenu({ label, items, disabled = false }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  function handleItemClick(item: MenuItem) {
    if (!item.disabled) {
      item.onClick?.();
      close();
    }
  }

  return (
    <div className="gdoc-dropdown-container" ref={containerRef}>
      <button
        className={`gdoc-menu-item${open ? " gdoc-menu-item--open" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </button>

      {open && (
        <div className="gdoc-dropdown-menu" role="menu" ref={menuRef}>
          {items.map((entry, i) => {
            if (entry.type === "separator") {
              return <div key={i} className="gdoc-dropdown-sep" role="separator" />;
            }
            const item = entry as MenuItem;
            return (
              <button
                key={i}
                className="gdoc-dropdown-item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
              >
                <span className="gdoc-dropdown-item-icon">{item.icon ?? null}</span>
                <span className="gdoc-dropdown-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="gdoc-dropdown-item-shortcut">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
