"use client";
import { db } from "@/app/firebaseconfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { type PageKey, navigationItems } from "./navigation";

/**
 * Storefront navigation + landing config, editable from /admin/config.
 *
 * Controls two things:
 *   1. `defaultHome` — the route the root page `/` redirects to, and the
 *      destination a client lands on after signing in. Daniel currently wants
 *      this to be /bet (the original raffles listing moved to /rifas).
 *   2. `visiblePages` — which storefront nav links are shown. Disabling a page
 *      only hides it from navigation (per Daniel's decision); the direct URL
 *      still works. It never hard-blocks a route.
 *
 * DEFAULTS ARE THE CURRENT LIVE BEHAVIOUR. A missing document, a denied read
 * or an unreachable Firestore must never break navigation: the app renders the
 * full nav and lands on /bet (then /rifas when Daniel switches it on).
 *
 * Document: `appConfig` / `general`
 */

export interface GeneralConfig {
  /** Route `/` redirects to (and post-login target). "/" means /rifas. */
  defaultHome: string;
  /** Visibility of each storefront nav page. true = link shown. */
  visiblePages: Record<PageKey, boolean>;
}

export const GENERAL_DEFAULTS: GeneralConfig = {
  defaultHome: "/bet",
  visiblePages: Object.fromEntries(
    navigationItems.map((item) => [item.key, true])
  ) as Record<PageKey, boolean>,
};

const PAGE_KEYS: PageKey[] = navigationItems.map((item) => item.key);

/** Non-empty stored values win; a valid "/x" route replaces the default. */
export function mergeGeneralConfig(
  stored: Partial<Record<keyof GeneralConfig, unknown>> | null
): GeneralConfig {
  const out: GeneralConfig = {
    defaultHome: GENERAL_DEFAULTS.defaultHome,
    visiblePages: { ...GENERAL_DEFAULTS.visiblePages },
  };
  if (!stored) return out;

  const home = stored.defaultHome;
  if (typeof home === "string" && /^\/[A-Za-z0-9/_-]*$/.test(home.trim()) && home.trim() !== "/") {
    out.defaultHome = home.trim();
  }

  const vp = stored.visiblePages;
  if (vp && typeof vp === "object") {
    for (const key of PAGE_KEYS) {
      const raw = (vp as Record<string, unknown>)[key];
      if (typeof raw === "boolean") out.visiblePages[key] = raw;
    }
  }
  return out;
}

/** The effective landing route: an explicit non-"/" home wins, else the raffles list. */
export function resolveDefaultHome(config: GeneralConfig): string {
  return config.defaultHome && config.defaultHome !== "/" ? config.defaultHome : "/rifas";
}

/**
 * Live navigation/landing config. Starts from the built-in defaults so the
 * first paint always shows the full nav and a working landing, then swaps in
 * stored values once Firestore responds.
 */
export function useGeneralConfig(): GeneralConfig {
  const [config, setConfig] = useState<GeneralConfig>(() => ({
    defaultHome: GENERAL_DEFAULTS.defaultHome,
    visiblePages: { ...GENERAL_DEFAULTS.visiblePages },
  }));

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const ref = doc(db, "appConfig", "general");
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          setConfig(snap.exists() ? mergeGeneralConfig(snap.data()) : { ...GENERAL_DEFAULTS });
        },
        (err) => {
          // Keep defaults; a nav failure must never blank the site.
          console.error("general config unavailable, using defaults:", err);
        }
      );
    } catch (err) {
      console.error("Could not subscribe to general config:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return config;
}
