"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { matchesAdminRoute, overviewHref, salesSections, settingsHref } from "./sections";

export default function AdminNavigation() {
  const pathname = usePathname();
  const activeSection = salesSections.find(({ links }) => links.some(({ href }) => matchesAdminRoute(pathname, href)));
  const entries = [
    { href: overviewHref, label: "Resumen", selected: pathname === overviewHref },
    ...salesSections.map(({ id, label, links }) => ({ href: links[0].href, label, selected: activeSection?.id === id })),
    { href: settingsHref, label: "Configuración", selected: pathname === settingsHref },
  ];

  return (
    <div className="mt-5 rounded-card border border-ink-100 bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Administración</span>
        <ThemeToggle />
      </div>
      <nav aria-label="Secciones de administración" className="grid grid-cols-2 gap-1 px-2 pb-2 sm:flex sm:flex-wrap sm:px-3">
        {entries.map(({ href, label, selected }) => (
          <Link key={href} href={href}
            aria-current={selected ? (matchesAdminRoute(pathname, href) ? "page" : "true") : undefined}
            className={`focus-ring flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold ${selected ? "bg-brand-100 text-on-brand" : "text-ink-700 hover:bg-ink-100"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {activeSection && activeSection.links.length > 1 && (
        <nav aria-label={`Opciones de ${activeSection.label.toLowerCase()}`} className="flex flex-wrap gap-x-3 border-t border-ink-100 px-3 py-1">
          {activeSection.links.map(({ href, label }) => {
            const active = matchesAdminRoute(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`focus-ring inline-flex min-h-11 items-center border-b-2 px-1.5 text-sm ${active ? "border-brand-500 font-bold text-ink-900" : "border-transparent text-ink-700 hover:text-ink-900"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
