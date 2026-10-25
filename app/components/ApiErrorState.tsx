"use client";
import React from "react";

/**
 * Shared error state for admin list pages.
 *
 * WHY THIS EXISTS
 * Admin pages fetch through `authedApiFetch`, which returns the Response even
 * when the call fails (401/403/500). The old pages called `res.json()` and
 * `setSales(data.sales)` without checking `res.ok`, so a rejected request set
 * the list to `undefined` and the following `.filter()` threw, white-screening
 * the route with "Application error: a client-side exception has occurred".
 *
 * Two rules for callers:
 *   1. Check `res.ok` and pass the failure here instead of rendering a list.
 *   2. Never render an empty list for an auth failure. "No sales" and "you are
 *      not signed in" look identical to an operator and the wrong one is
 *      expensive during a live event.
 */

export type ErrorKind = "session" | "forbidden" | "server" | "network";

/** Read the server's message without throwing on a non-JSON body. */
export async function safeMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.message === "string" ? data.message : "";
  } catch {
    return "";
  }
}

interface ApiErrorStateProps {
  kind: ErrorKind;
  message?: string;
  onRetry?: () => void;
  /** e.g. "apuestas" / "ventas" - used in the "no se pudieron cargar" line. */
  entityLabel: string;
}

const TITLES: Record<ErrorKind, string> = {
  session: "Tu sesión expiró",
  forbidden: "Se requiere cuenta de administrador",
  server: "El servidor no pudo responder",
  network: "Sin conexión con el servidor",
};

const HINTS: Record<ErrorKind, string> = {
  session:
    "Vuelve a iniciar sesión para continuar. No se perdió ninguna venta.",
  forbidden:
    "Tu cuenta inició sesión correctamente, pero no tiene permisos de administrador. Pide que activen tu acceso.",
  server:
    "Es un problema del servicio, no de tus datos. Intenta de nuevo en unos segundos.",
  network: "Revisa tu conexión y vuelve a intentar.",
};

export default function ApiErrorState({
  kind,
  message,
  onRetry,
  entityLabel,
}: ApiErrorStateProps) {
  return (
    <div
      role="alert"
      className="w-full max-w-xl mx-auto my-6 p-5 rounded-card border border-danger-500 bg-danger-50 text-center"
    >
      <p className="text-lg font-bold text-danger-700">{TITLES[kind]}</p>
      <p className="mt-1 text-sm text-danger-700">
        No se pudieron cargar las {entityLabel}.
      </p>
      <p className="mt-2 text-sm text-ink-700">{HINTS[kind]}</p>
      {message && (
        <p className="mt-2 text-xs text-ink-500 break-words">
          Detalle del servidor: {message}
        </p>
      )}
      <div className="mt-4 flex justify-center gap-3">
        {kind === "session" ? (
          <a
            href="/admin"
            className="p-2 rounded-card text-white"
            style={{ backgroundColor: "var(--color-brand-700)" }}
          >
            Iniciar sesión
          </a>
        ) : null}
        {onRetry && kind !== "session" ? (
          <button
            type="button"
            onClick={onRetry}
            className="p-2 rounded-card bg-ink-100 text-ink-900 hover:bg-ink-300 transition-colors"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  );
}
