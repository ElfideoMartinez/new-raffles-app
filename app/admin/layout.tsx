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
import ThemeToggle from "../components/ThemeToggle";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClientAuth } from "../components/clientAuth";

const NAV_SECTIONS: {
  title: string;
  links: { href: string; label: string }[];
}[] = [
  // Regrouped 2026-11-05 (Daniel): six labelled sections wrapped into four,
  // with shorter labels — the nav is a wayfinder, the dashboard remains the
  // full hub. No route was removed; the near-duplicate history pages (sales
  // vs salesBets) stay separate, still flagged in the backlog.
  {
    title: "Inicio",
    links: [{ href: "/admin/dashboard", label: "Dashboard" }],
  },
  {
    title: "Ventas",
    links: [
      { href: "/admin/sales", label: "Rifas" },
      { href: "/admin/salesBets", label: "Apuestas" },
      { href: "/admin/quickTickets/active", label: "Rápidas" },
    ],
  },
  {
    title: "Rifas y apuestas",
    links: [
      { href: "/admin/bets", label: "Administrar apuestas" },
      { href: "/admin/create/bet", label: "Crear apuesta" },
      { href: "/admin/edit/bet", label: "Editar apuesta" },
      { href: "/admin/create/raffle", label: "Crear rifa" },
      { href: "/admin/edit/raffle", label: "Editar rifa" },
    ],
  },
  {
    title: "Liquidación y ajustes",
    links: [
      { href: "/admin/settlement", label: "Liquidar apuestas" },
      { href: "/admin/config", label: "Textos y datos" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useClientAuth();

  // Every route in /admin except the login page "/admin" requires the admin
  // claim. While auth resolves or when the signed-in account is not an admin,
  // don't paint the shell (it would flash the nav + dashboard to a non-admin —
  // the old "still let me through" bug). Redirect away instead.
  useEffect(() => {
    if (pathname === "/admin") return;
    if (loading) return;
    if (!isAdmin) {
      router.replace("/");
    }
  }, [pathname, loading, isAdmin, router]);

  // The login page at exactly "/admin" renders for everyone.
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <p role="status" className="p-6 text-center text-sm text-ink-500">
        Cargando…
      </p>
    );
  }

  if (!isAdmin) return null;

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
                      ? "bg-brand-700 text-on-brand"
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
      {/* Dark-mode switch (2026-11-05): lives in the admin sidebar on every
          authenticated admin page. */}
      <div className="mx-auto mt-2 w-fit px-2">
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
