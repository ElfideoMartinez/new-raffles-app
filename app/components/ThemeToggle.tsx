"use client";
/**
 * Dark-mode switch (2026-11-05). Rendered in the admin sidebar, the mobile
 * hamburger menu and the desktop header rail — one component everywhere.
 * `aria-pressed` carries the state; the label announces the action, not the
 * current state, for screen readers ("Cambiar a modo oscuro/claro").
 */
import { useTheme } from "./theme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
    >
      {dark ? (
        /* Sun icon (currently dark → switch to light) */
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        /* Moon icon (currently light → switch to dark) */
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
      <span>{dark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
