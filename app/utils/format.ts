/**
 * Presentation formatters. Every user-facing price and date goes through these
 * so the same value never renders two ways on adjacent screens.
 *
 * Prices are MXN (the terms page states it; no other currency is accepted).
 * Dates are pinned to es-MX rather than the visitor's browser locale, which
 * would flip 21/10/2026 → 10/21/2026 for US visitors.
 */

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const mxDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

/** `50` → `$50.00`. Non-finite input renders `$0.00` rather than `$NaN`. */
export function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value);
  return mxn.format(Number.isFinite(n) ? n : 0);
}

/** ISO or yyyy-mm-dd → `21 oct 2026`. Unparseable input is returned as-is. */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return mxDate.format(d);
}

/** Same rules plus time, for receipts. → `21 oct 2026, 14:32` */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
