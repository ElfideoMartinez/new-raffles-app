"use client";
/**
 * Mis compras — purchase history for the signed-in client (2026-10-25).
 *
 * Data sources, newest first:
 *   1. Server: `getMyPurchases` (user-gated Cloud Function) returns the
 *      caller's `sales` (raffles) and `salesBets` docs — the server matches
 *      `userId == auth.uid`, the identity captured by `createTransferSale`
 *      from the checkout's Bearer token.
 *   2. Legacy fallback (pre-login purchases, device-associated): groups the
 *      storefront used to save in localStorage under the "purchases" key.
 *      These have no account attached, so they render marked "Compra sin
 *      cuenta" and never disappear when the customer signs in.
 *
 * Anonymous visitors still see their legacy local history plus a prompt to
 * sign in. Errors render via ApiErrorState — never an empty list for a
 * failure (401/403 are states, not "no compras").
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { FadeLoader } from "react-spinners";
import ApiErrorState from "../../components/ApiErrorState";
import { safeMessage } from "../../components/ApiErrorState";
import { userApiFetch, useClientAuth } from "../../components/clientAuth";
import { formatDateTime, formatPrice } from "@/app/utils/format";

interface LineItem {
  key: string;
  title: string;
  detail?: string;
  tickets: string;
  amount: number;
}

interface PurchaseGroup {
  id: string;
  date: string | null;
  legacy: boolean;
  total: number;
  /** verified == confirmed sale; false = waiting for the admin (open). */
  verified: boolean;
  settled?: boolean;
  outcome?: string; // A | B | C | VOID (settled bet sales)
  payoutStatus?: "paid" | "lost" | "refund" | null;
  payout?: number | null;
  items: LineItem[];
}

/** Shape returned by the getMyPurchases Cloud Function. */
interface ServerPurchase {
  id: string;
  kind: "raffle" | "bet";
  createdAt: string | null;
  verified: boolean;
  totalSalePrice?: number;
  totalBetsPrice?: number;
  payout?: number | null;
  payoutStatus?: string | null;
  settlements?: Record<string, { result?: string; status?: string }> | null;
  raffles?: Array<{
    raffleId: string;
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  bets?: Array<{
    betId: string;
    betName: string;
    team: string;
    ticketNumbers: number;
    totalPrice: number;
  }>;
}

/** Legacy localStorage shape (pre-login, device-associated purchases). */
interface LegacyGroup {
  date: string;
  raffles?: Array<{
    raffleId: string;
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  bets?: Array<{
    betId: string;
    betName: string;
    team: string;
    letterTeam: string;
    ticketNumbers: number;
    totalPrice: number;
  }>;
}

const OUTCOME_LABEL: Record<string, string> = {
  A: "Ganó equipo A",
  B: "Ganó equipo B",
  C: "Empate",
  VOID: "Apuesta anulada (reembolso)",
};

function statusBadge(group: PurchaseGroup) {
  if (group.settled) {
    if (group.payoutStatus === "paid" || group.payoutStatus === "refund") {
      return (
        <span className="px-2 py-1 rounded-pill text-xs bg-success-50 text-success-700">
          ✓ Ganada{group.payout ? ` — ${formatPrice(group.payout)}` : ""}
        </span>
      );
    }
    if (group.payoutStatus === "lost") {
      return (
        <span className="px-2 py-1 rounded-pill text-xs bg-danger-50 text-danger-700">
          Perdida
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-pill text-xs bg-success-50 text-success-700">
        ✓ Liquidada
      </span>
    );
  }
  if (group.verified) {
    return (
      <span className="px-2 py-1 rounded-pill text-xs bg-success-50 text-success-700">
        ✓ Confirmada
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-pill text-xs bg-warning-50 text-ink-900">
      Pendiente de confirmar
    </span>
  );
}

function toGroups(server: ServerPurchase[], legacy: LegacyGroup[]): PurchaseGroup[] {
  const serverGroups: PurchaseGroup[] = server.map((sale) => {
    const items: LineItem[] = [];
    for (const r of sale.raffles ?? []) {
      items.push({
        key: `r-${sale.id}-${r.raffleId}`,
        title: `🎟 Rifa: ${r.raffleName}`,
        tickets: `Boletos: ${r.ticketNumbers.join(", ")}`,
        amount: r.raffleTotalPrice,
      });
    }
    for (const b of sale.bets ?? []) {
      items.push({
        key: `b-${sale.id}-${b.betId}`,
        title: `🎟 Apuesta: ${b.betName}`,
        detail: `Equipo: ${b.team}`,
        tickets: `Boletos: ${b.ticketNumbers}`,
        amount: b.totalPrice,
      });
    }
    const settlementEntries = Object.values(sale.settlements ?? {});
    const settled =
      sale.kind === "bet" &&
      settlementEntries.length > 0 &&
      settlementEntries.every((s) => s.status === "paid" || s.status === "lost" || s.status === "refund");
    const outcome = settlementEntries[0]?.result;
    return {
      id: sale.id,
      date: sale.createdAt,
      legacy: false,
      total: sale.totalSalePrice ?? sale.totalBetsPrice ?? 0,
      verified: sale.verified,
      settled,
      outcome,
      payoutStatus: (sale.payoutStatus as PurchaseGroup["payoutStatus"]) ?? null,
      payout: sale.payout ?? null,
      items,
    };
  });

  const legacyGroups: PurchaseGroup[] = legacy.map((group, index) => {
    const items: LineItem[] = [];
    for (const r of group.raffles ?? []) {
      items.push({
        key: `lr-${index}-${r.raffleId}`,
        title: `🎟 Rifa: ${r.raffleName}`,
        tickets: `Boletos: ${r.ticketNumbers.join(", ")}`,
        amount: r.raffleTotalPrice,
      });
    }
    for (const b of group.bets ?? []) {
      items.push({
        key: `lb-${index}-${b.betId}`,
        title: `🎟 Apuesta: ${b.betName}`,
        detail: `Equipo: ${b.team}`,
        tickets: `Boletos: ${b.ticketNumbers}`,
        amount: b.totalPrice,
      });
    }
    return {
      id: `legacy-${index}`,
      date: group.date,
      legacy: true,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      verified: false,
      items,
    };
  });

  return [...serverGroups, ...legacyGroups].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });
}

const MyPurchasesPage = () => {
  const { user, loading: authLoading } = useClientAuth();
  const [groups, setGroups] = useState<PurchaseGroup[]>([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [error, setError] = useState<{ kind: "session" | "forbidden" | "server" | "network"; message?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      // Legacy device-associated purchases load regardless of login state.
      let legacy: LegacyGroup[] = [];
      try {
        const saved = localStorage.getItem("purchases");
        if (saved) legacy = JSON.parse(saved) as LegacyGroup[];
      } catch {
        legacy = [];
      }
      setLegacyCount(legacy.length);

      if (!user) {
        setGroups(toGroups([], legacy));
        setLoading(false);
        return;
      }
      try {
        const res = await userApiFetch("getMyPurchases", { method: "POST" });
        if (!res.ok) {
          const message = await safeMessage(res);
          if (!cancelled) {
            setError({
              kind: res.status === 401 ? "session" : res.status === 403 ? "forbidden" : res.status >= 500 ? "server" : "server",
              message,
            });
          }
          return;
        }
        const data = (await res.json()) as { purchases?: ServerPurchase[] };
        if (!cancelled) setGroups(toGroups(data.purchases ?? [], legacy));
      } catch {
        if (!cancelled) setError({ kind: "network" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="relative mx-auto mt-4 w-full max-w-3xl p-4">
        <h1 className="text-center mb-3 text-xl font-bold text-ink-900">Mis compras</h1>
        <div className="flex justify-center h-40 items-center">
          <FadeLoader color="var(--color-brand-700)" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full items-center px-4">
      <div className="w-full max-w-3xl my-6">
        <h1 className="text-center mb-3 text-xl font-bold text-ink-900">Mis compras</h1>

        {!user && (
          <div className="mb-4 bg-surface rounded-card border border-ink-100 shadow-card p-4 text-center">
            <p className="text-sm text-ink-700">
              No has iniciado sesión. Solo se muestran compras guardadas en este
              dispositivo;{" "}
              <Link href="/login?next=/user/my-purchases" className="font-semibold text-brand-700 hover:underline">
                inicia sesión
              </Link>{" "}
              para ver el historial completo de tu cuenta.
            </p>
          </div>
        )}

        {error ? (
          <ApiErrorState kind={error.kind} message={error.message} entityLabel="compras" />
        ) : groups.length === 0 ? (
          <p className="text-center text-ink-500 text-sm">No hay compras registradas.</p>
        ) : (
          <ul className="space-y-6">
            {groups.map((group) => {
              const isOpen = openId === group.id;
              return (
                <li key={group.id} className="bg-surface rounded-card border border-ink-100 shadow-card p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-ink-700">
                        📅 {group.date ? formatDateTime(group.date) : "Fecha no disponible"}
                      </p>
                      {group.legacy && (
                        <span className="px-2 py-1 rounded-pill text-xs bg-ink-100 text-ink-500">
                          Compra sin cuenta
                        </span>
                      )}
                      {statusBadge(group)}
                      {group.settled && group.outcome && OUTCOME_LABEL[group.outcome] && (
                        <span className="px-2 py-1 rounded-pill text-xs bg-ink-100 text-ink-700">
                          {OUTCOME_LABEL[group.outcome]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : group.id)}
                        aria-expanded={isOpen}
                        className="rounded-sm bg-ink-100 text-ink-900 px-3 py-1.5 text-sm font-semibold hover:bg-ink-300 transition-colors"
                      >
                        {isOpen ? "Ocultar detalles" : `Ver detalles (${group.items.length})`}
                      </button>
                      <Link
                        href="/soporte"
                        className="rounded-sm bg-ink-100 text-ink-900 px-3 py-1.5 text-sm font-semibold hover:bg-ink-300 transition-colors"
                      >
                        Reportar problema
                      </Link>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      <ul className="space-y-3 mt-3">
                        {group.items.map((item) => (
                          <li
                            key={item.key}
                            className="rounded-card border border-ink-100 bg-ink-100/40 p-3 md:flex md:justify-between md:items-center"
                          >
                            <section className="text-sm text-ink-700">
                              <strong className="text-ink-900">{item.title}</strong>
                              {item.detail && (
                                <>
                                  <br />
                                  {item.detail}
                                </>
                              )}
                              <br />
                              {item.tickets}
                            </section>
                            <p className="text-sm font-semibold text-ink-900 mt-2 md:mt-0">
                              {formatPrice(item.amount)}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-right text-sm font-bold text-ink-900">
                        Total: {formatPrice(group.total)}
                        {group.settled && group.payoutStatus === "paid" && group.payout
                          ? ` — Pago: ${formatPrice(group.payout)}`
                          : ""}
                        {group.settled && group.payoutStatus === "refund"
                          ? " — Reembolso total"
                          : ""}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {legacyCount > 0 && (
          <p className="mt-4 text-center text-xs text-ink-500">
            Las compras marcadas "sin cuenta" se guardaban solo en este
            dispositivo antes de que existiera el inicio de sesión.
          </p>
        )}
      </div>
    </div>
  );
};

export default MyPurchasesPage;