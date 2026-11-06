"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useClientAuth, clientLogout } from "./clientAuth";
import CartButton from "./CartButton";
import { navigationItems, isNavItemActive } from "@/app/config/navigation";
import HamburgerMenu from "./HamburgerMenu";
import ThemeToggle from "./ThemeToggle";

// Mirrors `accountLabel` in clientAuth: prefers the signed-in name, else email.
function accountDisplay(user: { displayName?: string | null; email?: string | null } | null): string {
  if (!user) return "";
  if (user.displayName) return user.displayName;
  return user.email ?? "";
}

const MainHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin } = useClientAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="sticky top-0 z-40 bg-gradient-to-b from-brand-500 to-accent-400 text-on-brand shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4">
          <button
            ref={menuButtonRef}
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-white/15 text-on-brand transition-colors hover:bg-white/25"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Rifas Mtz — inicio">
            <Image
              className="h-10 w-10 rounded-pill ring-2 ring-white/40"
              src="/icon.jpg"
              alt=""
              width={40}
              height={40}
            />
            <span className="hidden truncate text-base font-bold tracking-tight sm:block">
              Rifas Mtz
            </span>
          </Link>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
            <CartButton />
          </div>
        </div>

        {/* Desktop+ rail: the shared primary links that the mobile hamburger
            hides behind a menu. Desktop gets a persistent rail; mobile keeps
            the hamburger. Both surfaces draw from `navigationItems`. */}
        <nav
          aria-label="Navegación de escritorio"
          className="border-t border-white/10 hidden sm:flex"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
            {navigationItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center rounded-sm px-3 py-2 text-sm font-medium transition-colors sm:px-4 sm:py-2.5 ${
                  isNavItemActive(href, pathname)
                    ? "bg-white/20 font-bold text-on-brand"
                    : "text-on-brand/80 hover:bg-white/10 hover:text-on-brand"
                }`}
              >
                {label}
              </Link>
            ))}

            {/* Admin (2026-11-06): a user carrying the admin claim reaches the
                admin area from the same header — no separate login/account.
                Uses isNavItemActive so it highlights while inside /admin. */}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className={`flex items-center rounded-sm px-3 py-2 text-sm font-medium transition-colors sm:px-4 sm:py-2.5 ${
                  isNavItemActive("/admin", pathname)
                    ? "bg-white/20 font-bold text-on-brand"
                    : "text-on-brand/80 hover:bg-white/10 hover:text-on-brand"
                }`}
              >
                Admin
              </Link>
            )}

            {user ? (
              <button
                type="button"
                onClick={() => {
                  void clientLogout();
                  setMenuOpen(false);
                  router.refresh();
                }}
                className="flex min-h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-on-brand/80 transition-colors hover:bg-white/10 hover:text-on-brand"
              >
                <span className="truncate max-w-[140px] text-left text-ink-100">
                  {accountDisplay(user)}
                </span>
                <span className="rounded border border-white/20 px-2 py-0.5 text-xs font-semibold text-white/70">
                  Cerrar sesión
                </span>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex min-h-11 items-center rounded-sm px-3 py-2 text-sm font-medium text-on-brand/80 transition-colors hover:bg-white/10 hover:text-on-brand"
              >
                Iniciar sesión
              </Link>
            )}
            <div className="ml-auto flex items-center">
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>

      <HamburgerMenu
        id="main-navigation"
        hidden={!menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />
    </div>
  );
};

export default MainHeader;
