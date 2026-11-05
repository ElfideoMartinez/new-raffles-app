"use client";
/**
 * Theme state (2026-11-05): light ↔ dark, driven by the `.dark` class on
 * <html> that re-derives every token (see app/globals.css).
 *
 * The choice persists in localStorage (`rmtz-theme`) and is applied
 * pre-paint by the boot script in app/layout.tsx, so this hook only reads
 * the stored value on mount (no flash) and writes it on toggle. Default is
 * light; there is no media-query auto-detect on purpose — the store keeps a
 * consistent brand look until the visitor opts into dark.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "rmtz-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode / storage disabled: session-only theme.
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
