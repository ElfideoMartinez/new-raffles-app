"use client";
// Persistent admin navigation (backlog 12.2). Before this, every admin page
// dead-ended into a single "Volver al inicio" link; navigating between admin
// pages required going back to the dashboard each time. This layout renders a
// shared nav bar above every page in the /admin segment. The login page lives
// at exactly "/admin", so the nav is skipped there.
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin/dashboard", label: "Inicio" },
  { href: "/admin/sales", label: "Ventas/Rifas" },
  { href: "/admin/salesBets", label: "Ventas/Apuestas" },
  { href: "/admin/bets", label: "Apuestas" },
  { href: "/admin/settlement", label: "Liquidación" },
  { href: "/admin/config", label: "Configuración" },
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
        className="flex flex-wrap gap-2 justify-center mt-4"
      >
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`focus-ring px-3 py-1.5 text-sm rounded-card ${
                active
                  ? "bg-brand-700 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
