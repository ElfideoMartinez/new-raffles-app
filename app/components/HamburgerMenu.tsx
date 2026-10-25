"use client";
/**
 * Client sidebar/menu (hamburger, opened from the main header).
 *
 * 2026-10-25: extended from a plain link list into the client menu with the
 * purchases history, notification settings, and the login/logout state
 * (client login, Model A identity). Anonymous visitors see "Iniciar sesión";
 * signed-in clients see their account and "Cerrar sesión". The admin login
 * lives at /admin and is intentionally NOT linked here — the client menu is
 * customer-facing only.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clientLogout,
  useClientAuth,
  type MockClientUser,
} from "./clientAuth";
import type { User } from "firebase/auth";

function accountLabel(user: User | MockClientUser | null): string {
  if (!user) return "";
  if ("displayName" in user && user.displayName) return user.displayName;
  return user.email ?? "";
}

export default function HamburgerMenu({ className = "" }) {
  const { user } = useClientAuth();
  const router = useRouter();

  return (
    <div
      className={`absolute top-2/3 left-4 mt-2 w-56 bg-white text-ink-700 font-semibold shadow-card rounded-card border border-ink-100 p-2 transition-all duration-300 ease-out ${className}`}
    >
      <Link
        href="/user/my-purchases"
        className='block px-4 py-3 rounded-sm hover:bg-ink-100 transition-colors'
      >
        👜 Mis compras
      </Link>
      <Link
        href="/user/notificaciones"
        className='block px-4 py-3 rounded-sm hover:bg-ink-100 transition-colors'
      >
        🔔 Notificaciones
      </Link>
      <Link
        href='/contact'
        className='block px-4 py-3 rounded-sm hover:bg-ink-100 transition-colors'
      >
        ℹ️ Contacto
      </Link>
      <Link
        href='/quickTicket/play'
        className='block px-4 py-3 rounded-sm hover:bg-ink-100 transition-colors'
      >
        🎟️ Rascadito Rápido
      </Link>

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
                router.refresh();
              }}
              className='block w-full text-left px-4 py-3 rounded-sm hover:bg-ink-100 transition-colors text-ink-900'
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className='block px-4 py-3 rounded-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors text-center'
          >
            Iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}