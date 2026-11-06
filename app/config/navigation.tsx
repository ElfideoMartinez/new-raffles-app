// Shared primary navigation items for the customer-facing storefront.
//
// Single source of truth for the six top-level links that appear in BOTH the
// desktop header rail and the mobile hamburger menu. Keeping the list in one
// place prevents the two nav surfaces from drifting (a recurring defect in
// this repo: a label added to one surface and forgotten on the other).
//
// Auth-dependent entries (Iniciar sesión / Cerrar sesión) are rendered by the
// components that own the user session; this file only owns the public links.

export type PageKey =
  | "rifas"
  | "bet"
  | "quickTicket"
  | "myPurchases"
  | "notificaciones"
  | "contact";

export interface NavigationItem {
  /** Stable id used by the visibility config (appConfig/general). */
  key: PageKey;
  href: string;
  label: string;
}

// `/` is no longer a content page (2026-11-06): it redirects to the configured
// default home (appConfig/general.defaultHome). The raffles listing moved to
// /rifas so it keeps its own nav entry and a real route.
export const navigationItems: NavigationItem[] = [
  { key: "rifas", href: "/rifas", label: "Rifas activas" },
  { key: "bet", href: "/bet", label: "Apuestas" },
  { key: "quickTicket", href: "/quickTicket/play", label: "Rascadito Rápido" },
  { key: "myPurchases", href: "/user/my-purchases", label: "Mis compras" },
  { key: "notificaciones", href: "/user/notificaciones", label: "Notificaciones" },
  { key: "contact", href: "/contact", label: "Contacto" },
];

/** True when the current page is the target route or a child of it. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
