"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  clientLogout,
  useClientAuth,
  type MockClientUser,
} from "@/app/components/clientAuth";
import { navigationItems } from "@/app/config/navigation";
import ThemeToggle from "./ThemeToggle";
import type { User } from "firebase/auth";

function accountLabel(user: User | MockClientUser | null): string {
  if (!user) return "";
  if ("displayName" in user && user.displayName) return user.displayName;
  return user.email ?? "";
}

export default function HamburgerMenu({
  id,
  hidden,
  onNavigate,
}: {
  id: string;
  hidden: boolean;
  onNavigate: () => void;
}) {
  const { user, isAdmin } = useClientAuth();
  const router = useRouter();
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `flex min-h-11 items-center rounded-sm px-4 py-2 transition-colors ${
      pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
        ? "bg-brand-50 font-bold text-brand-700"
        : "text-ink-700 hover:bg-ink-100"
    }`;

  return (
    <nav
      id={id}
      hidden={hidden}
      aria-label="Navegación principal"
      className="absolute left-2 right-2 top-16 z-50 rounded-card border border-ink-100 bg-surface p-2 text-sm shadow-card sm:left-4 sm:right-auto sm:w-72"
    >
      <ul className="space-y-1">
        {navigationItems.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className={linkClass(href)}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        ))}

        {/* Admin (2026-11-06): same account reaches the admin area; shown only
            to users carrying the admin claim. */}
        {isAdmin && (
          <li>
            <Link
              href="/admin/dashboard"
              onClick={onNavigate}
              className={linkClass("/admin")}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            >
              Admin
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-2 border-t border-ink-100 pt-2">
        <ThemeToggle />
      </div>

      <div className="mt-2 border-t border-ink-100 pt-2">
        {user ? (
          <>
            <p className="truncate px-4 py-2 text-xs font-normal text-ink-500">
              {accountLabel(user)}
            </p>
            <button
              type="button"
              onClick={async () => {
                await clientLogout();
                onNavigate();
                router.refresh();
              }}
              className="flex min-h-11 w-full items-center rounded-sm px-4 py-2 text-left text-ink-900 transition-colors hover:bg-ink-100"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex min-h-11 items-center justify-center rounded-pill bg-brand-600 px-4 py-2 font-semibold text-on-brand transition-colors hover:bg-brand-700"
          >
            Iniciar sesión
          </Link>
        )}
      </div>
    </nav>
  );
}
