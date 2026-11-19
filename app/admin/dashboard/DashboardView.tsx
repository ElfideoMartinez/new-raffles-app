"use client";

import Link from "next/link";
import { formatPrice } from "@/app/utils/format";
import { salesSections } from "../sections";
import type { DashboardStats } from "./types";

const number = new Intl.NumberFormat("es-MX");
const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chihuahua" });
const statuses = {
  verified: "Confirmada",
  unverified: "Sin verificar",
  active: "Activado",
  finnished: "Finalizado",
  pending: "Pendiente de activar",
  unknown: "Estado desconocido",
};
const icons = {
  raffles: "M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Zm10 2v2m0 2v2m0 2v2",
  bets: "M4 19h16M6 15v-3m6 3V8m6 7V4",
  quick: "m13 2-8 12h6l-1 8 9-12h-6l1-8Z",
};

export default function DashboardView({ stats, loading = false, error, onRetry }: {
  stats?: DashboardStats;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="space-y-5 text-ink-900">
      <header className="rounded-card border border-ink-100 bg-gradient-to-br from-brand-100/40 to-surface dark:from-brand-100/10 px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-700">Panel de administración</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Resumen de ventas</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-700 sm:text-base">Consulta los registros recientes y abre las herramientas de cada categoría.</p>
      </header>

      {loading && <p role="status" className="text-sm text-ink-700">Cargando estadísticas…</p>}
      {error && (
        <div className="flex flex-wrap items-center gap-x-4 rounded-sm border border-danger-500 bg-danger-500/10 px-4 py-2">
          <p role="alert" className="text-sm text-ink-900">{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="focus-ring min-h-11 rounded-sm px-2 text-sm font-bold text-ink-900 underline">Reintentar</button>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {salesSections.map(({ id, label, links, description }) => {
          const values = stats?.[id];
          const latest = values?.latest;
          const amount = latest && "amount" in latest ? latest.amount : null;
          const [primary, ...secondary] = links;
          return (
            <section key={id} aria-labelledby={`overview-${id}`} className="flex min-w-0 flex-col rounded-card border border-ink-100 bg-surface p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-brand-100 text-on-brand">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[id]} /></svg>
                </span>
                <div>
                  <h2 id={`overview-${id}`} className="text-lg font-bold">{label}</h2>
                  <p className="text-sm text-ink-700">{description}</p>
                </div>
              </div>

              <div className="mb-4 mt-5 rounded-sm bg-ink-100/60 p-4">
                <p className="text-sm font-semibold text-ink-700">{id === "quick" ? "Último boleto" : "Última venta"}</p>
                {latest ? (
                  <>
                    <p className={`mt-1 break-words font-bold ${id === "quick" ? "text-lg" : "text-2xl tabular-nums"}`}>
                      {id === "quick" ? statuses[latest.status] : amount === null ? "Importe no disponible" : formatPrice(amount)}
                    </p>
                    {id !== "quick" && <p className="text-sm font-semibold text-ink-700">{statuses[latest.status]}</p>}
                    <p className="mt-2 text-sm text-ink-700">
                      {latest.createdAt === null ? "Fecha no disponible" : (
                        <time dateTime={new Date(latest.createdAt).toISOString()}>{date.format(latest.createdAt)}</time>
                      )}
                    </p>
                  </>
                ) : <p className="mt-1 text-sm text-ink-700">{values ? "No hay registros recientes." : "—"}</p>}
              </div>

              <Link href={primary.href} className="focus-ring inline-flex min-h-11 items-center justify-between gap-2 rounded-sm bg-brand-100 px-3 text-sm font-bold text-on-brand hover:bg-brand-300">
                {primary.label}<span aria-hidden="true">→</span>
              </Link>
              {secondary.length > 0 && (
                <ul className="mt-2 divide-y divide-ink-100">
                  {secondary.map(({ href, label }) => (
                    <li key={href}><Link href={href} className="focus-ring flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900">{label}</Link></li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <details className="rounded-card border border-ink-100 bg-surface shadow-card">
        <summary className="focus-ring min-h-11 cursor-pointer rounded-card px-5 py-3 font-semibold">Totales de ventas</summary>
        <div className="space-y-3 px-5 pb-5">
          <p className="text-sm text-ink-700">{stats ? "Importes confirmados en MXN, no ganancias netas. Los boletos rápidos no registran importes." : "Totales no disponibles por el momento."}</p>
          {stats && (
            <div className="grid gap-3 md:grid-cols-3">
              {salesSections.map(({ id, label }) => {
                const values = stats[id];
                return (
                  <div key={id} className="rounded-sm bg-ink-100/60 p-4">
                    <h2 className="font-bold">{label}</h2>
                    <dl className="mt-2 space-y-1 text-sm">
                      {"amount" in values && <div className="flex flex-wrap justify-between gap-x-2"><dt>Importe confirmado</dt><dd className="font-bold tabular-nums">{formatPrice(values.amount)}</dd></div>}
                      <div className="flex justify-between gap-2"><dt>{id === "quick" ? "Activados o finalizados" : "Confirmadas"}</dt><dd className="font-semibold tabular-nums">{number.format(values.confirmed)}</dd></div>
                      <div className="flex justify-between gap-2"><dt>{id === "quick" ? "Pendientes de activar" : "Sin verificar"}</dt><dd className="font-semibold tabular-nums">{number.format(values.pending)}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-ink-700">{values.limited ? "Últimos 500 registros" : id === "quick" ? "Todos los boletos registrados" : "Todos los registros con fecha"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </main>
  );
}
