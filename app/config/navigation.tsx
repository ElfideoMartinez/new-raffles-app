// Shared primary navigation items for the customer-facing storefront.
//
// Single source of truth for the six top-level links that appear in BOTH the
// desktop header rail and the mobile hamburger menu. Keeping the list in one
// place prevents the two nav surfaces from drifting (a recurring defect in
// this repo: a label added to one surface and forgotten on the other).
//
// Auth-dependent entries (Iniciar sesión / Cerrar sesión) are rendered by the
// components that own the user session; this file only owns the public links.

export interface NavigationItem {
  href: string;
  label: string;
}

export const navigationItems: NavigationItem[] = [
  { href: "/", label: "Rifas activas" },
  { href: "/bet", label: "Apuestas" },
  { href: "/quickTicket/play", label: "Rascadito Rápido" },
  { href: "/user/my-purchases", label: "Mis compras" },
  { href: "/user/notificaciones", label: "Notificaciones" },
  { href: "/contact", label: "Contacto" },
];

/** True when the current page is the target route or a child of it. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
