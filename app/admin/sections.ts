export const overviewHref = "/admin/dashboard";
export const settingsHref = "/admin/config";

export const salesSections = [
  {
    id: "raffles",
    label: "Rifas",
    description: "Ventas de rifas y administración de sorteos.",
    links: [
      { href: "/admin/sales", label: "Ventas de rifas" },
      { href: "/admin/create/raffle", label: "Crear rifa" },
      { href: "/admin/edit/raffle", label: "Editar rifa" },
    ],
  },
  {
    id: "bets",
    label: "Apuestas",
    description: "Ventas, carteleras y liquidación de apuestas.",
    links: [
      { href: "/admin/salesBets", label: "Ventas de apuestas" },
      { href: "/admin/bets", label: "Administrar apuestas" },
      { href: "/admin/create/bet", label: "Crear apuesta" },
      { href: "/admin/create-from-card", label: "Crear desde cartelera" },
      { href: "/admin/edit/bet", label: "Editar apuesta" },
      { href: "/admin/settlement", label: "Liquidar apuestas" },
    ],
  },
  {
    id: "quick",
    label: "Boletos rápidos",
    description: "Estado de los boletos de Rascadito Rápido.",
    links: [{ href: "/admin/quickTickets/active", label: "Gestionar boletos rápidos" }],
  },
] as const;

export function matchesAdminRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
