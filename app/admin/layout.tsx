"use client";
// Persistent admin navigation (backlog 12.2). Before this, every admin page
// dead-ended into a single "Volver al inicio" link; navigating between admin
// pages required going back to the dashboard each time. This layout renders a
// shared nav bar above every page in the /admin segment. The login page lives
// at exactly "/admin", so the nav is skipped there.
//
// Reorganised 2026-10-25 into labelled Spanish sections (task: group the admin
// nav). Every admin route appears exactly once, mapped to the section that
// matches its job: history under Ventas/Compras, creation/management under
// Apuestas y rifas, settlement under Liquidación, store data under Ajustes.
// Near-duplicate history pages (sales vs salesBets) are NOT merged here —
// noted in ufc-mission/backlog.md instead.
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: {
  title: string;
  links: { href: string; label: string }[];
}[] = [
  {
    title: "Inicio",
    links: [{ href: "/admin/dashboard", label: "Dashboard" }],
  },
  {
    title: "Ventas/Compras",
    links: [
      { href: "/admin/sales", label: "Ventas de rifas" },
      { href: "/admin/salesBets", label: "Ventas de apuestas" },
      { href: "/admin/quickTickets/active", label: "Ventas rápidas" },
    ],
  },
  {
    title: "Apuestas y rifas",
    links: [
      { href: "/admin/bets", label: "Administrar apuestas" },
      { href: "/admin/create/bet", label: "Crear apuesta" },
      { href: "/admin/edit/bet", label: "Editar apuesta" },
      { href: "/admin/create/raffle", label: "Crear rifa" },
      { href: "/admin/edit/raffle", label: "Editar rifa" },
    ],
  },
  {
    title: "Liquidación",
    links: [{ href: "/admin/settlement", label: "Liquidar apuestas" }],
  },
  {
    title: "Ajustes",
    links: [{ href: "/admin/config", label: "Textos y datos de la tienda" }],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin") {
    // Login page: no navigation yet, the visitor is not signed in.
    return <>{children}</>;
  }

  return (
    <>
      <nav
        aria-label="Navegación de administración"
        className="mt-4 flex flex-col gap-1.5 px-2"
      >
        {NAV_SECTIONS.map(({ title, links }) => (
          <div
            key={title}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500 mr-1">
              {title}
            </span>
            {links.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring px-3 py-1.5 text-sm rounded-sm ${
                    active
                      ? "bg-brand-700 text-white"
                      : "bg-ink-100 text-ink-900 hover:bg-ink-300"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {children}
    </>
  );
}
