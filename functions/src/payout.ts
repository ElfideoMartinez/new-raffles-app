/**
 * Pari-mutuel payout math — single source of truth for the bets model
 * (DESIGN-AUDIT.md B2, Option A, ratified 2026-10-22).
 *
 * Model: every accepted ticket stakes `pricePerTicket` into one pool.
 * Settlement: pool × (1 − takeRate) is split equally among winning tickets.
 * If the winning outcome has zero tickets (or the event is void), every
 * ticket is refunded in full and the organizer keeps nothing.
 *
 * All money math is done in integer centavos so floating point can never
 * create or destroy funds. `payoutPerTicket` is floored to the centavo; the
 * flooring remainder (breakage) stays with the organizer, a disclosed rule.
 *
 * The client (app/bet/[id]/BetPageClient.tsx) repeats only the ESTIMATE
 * formula shape for display; it must never be treated as authoritative.
 */

/** Default take rate; migrate to a Remote Config parameter `betsTakeRate`. */
export const DEFAULT_TAKE_RATE = 0.1;

export type BetOutcome = "A" | "B" | "C";

/** Parse a Remote Config take-rate parameter value defensively. */
export function sanitizeTakeRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n >= 1) return null;
  return n;
}

export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Total money pool in centavos: tickets × pricePerTicket. */
export function poolCents(
  totalTickets: number,
  pricePerTicket: number
): number {
  return toCents(totalTickets * pricePerTicket);
}

/** Distributable pool after the disclosed take, floored to centavos. */
export function distributableCents(poolCentsValue: number, takeRate: number) {
  return Math.floor(poolCentsValue * (1 - takeRate));
}

/**
 * Payout per winning ticket in centavos (floor). Returns 0 when there are no
 * winning tickets — callers must treat that as refund-all, never divide here.
 */
export function payoutPerTicketCents(
  distributableCentsValue: number,
  winningTickets: number
): number {
  if (!Number.isFinite(distributableCentsValue) || winningTickets <= 0) {
    return 0;
  }
  return Math.floor(distributableCentsValue / winningTickets);
}
