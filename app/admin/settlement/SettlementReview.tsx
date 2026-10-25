"use client";
// Settlement review view: computes payouts client-side from live verified
// salesBets docs, mirroring settleBet's maths. Extracted from page.tsx so the
// Next.js Page module keeps only the default export.
import { authedApiFetch } from "@/app/config/api";
import ApiErrorState, {
  safeMessage,
  type ErrorKind,
} from "@/app/components/ApiErrorState";
import { useEffect, useMemo, useState } from "react";
import { FadeLoader } from "react-spinners";
import { formatDate, formatPrice } from "@/app/utils/format";

interface IBetsData {
  title: string;
  pricePerTicket: string;
  date: string;
  description: string;
  teams: { a: string; b: string };
  tieBets?: number;
  isFinished: boolean;
  settled?: boolean;
  result?: string;
  payoutPerTicket?: number;
}

interface ISaleData {
  id: string;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  verified?: unknown;
  bets?: unknown;
}

type Outcome = "A" | "B" | "C" | "VOID";

const OUTCOME_LABELS: Record<Outcome, string> = {
  A: "Gana A",
  B: "Gana B",
  C: "Empate",
  VOID: "VOID (anulada)",
};

// Default take rate (settleBet reads it from Remote Config; the client cannot).
const TAKE_RATE = 0.1;

function lineOutcome(line: unknown): "A" | "B" | "C" | null {
  const entry = (line ?? {}) as Record<string, unknown>;
  const letter =
    typeof entry.letterTeam === "string"
      ? entry.letterTeam.trim().toUpperCase()
      : "";
  if (letter === "A" || letter === "B" || letter === "C") return letter;
  return null;
}

interface SaleRow {
  saleId: string;
  name: string;
  email: string;
  phone: string;
  tickets: number;
  byOutcome: { A: number; B: number; C: number };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function SettlementReview({
  bet,
  onBack,
}: {
  bet: IBetsData & { id: string };
  onBack: () => void;
}) {
  const pricePerTicket = parseFloat(bet.pricePerTicket);
  const [sales, setSales] = useState<ISaleData[] | null>(null);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(
    null
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settleResponse, setSettleResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadSales = async () => {
    setSales(null);
    setError(null);
    try {
      const res = await authedApiFetch("getSalesBets", { method: "GET" });
      if (!res.ok) {
        setError({
          kind: res.status === 401 ? "session" : res.status === 403 ? "forbidden" : "server",
          message: await safeMessage(res),
        });
        return;
      }
      const data = await res.json();
      setSales(Array.isArray(data?.betSales) ? data.betSales : []);
    } catch (err) {
      console.error("Error fetching salesBets:", err);
      setError({ kind: "network", message: "No se pudo conectar con el servidor." });
    }
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet.id]);

  // Client-side computation mirroring settleBet (verified salesBets docs only).
  const rows: SaleRow[] = useMemo(() => {
    if (!sales) return [];
    const out: SaleRow[] = [];
    for (const sale of sales) {
      if (sale.verified !== true) continue;
      const lines = Array.isArray(sale.bets) ? sale.bets : [];
      const byOutcome = { A: 0, B: 0, C: 0 };
      for (const line of lines) {
        const entry = (line ?? {}) as Record<string, unknown>;
        if (entry.betId !== bet.id) continue;
        const team = lineOutcome(line);
        if (!team) continue;
        const tickets = Number(entry.ticketNumbers);
        if (!Number.isFinite(tickets) || tickets <= 0) continue;
        byOutcome[team] += tickets;
      }
      const tickets = byOutcome.A + byOutcome.B + byOutcome.C;
      if (tickets > 0) {
        out.push({
          saleId: sale.id,
          name: asString(sale.name),
          email: asString(sale.email),
          phone: asString(sale.phone),
          tickets,
          byOutcome,
        });
      }
    }
    return out;
  }, [sales, bet.id]);

  const totals = useMemo(() => {
    const ticketsByOutcome = rows.reduce(
      (acc, r) => ({
        A: acc.A + r.byOutcome.A,
        B: acc.B + r.byOutcome.B,
        C: acc.C + r.byOutcome.C,
      }),
      { A: 0, B: 0, C: 0 }
    );
    const totalTickets = ticketsByOutcome.A + ticketsByOutcome.B + ticketsByOutcome.C;
    const poolCents = Math.round(totalTickets * pricePerTicket * 100);
    const distributableCents = Math.floor(poolCents * (1 - TAKE_RATE));
    const takeCents = poolCents - distributableCents;
    return { ticketsByOutcome, totalTickets, poolCents, distributableCents, takeCents };
  }, [rows, pricePerTicket]);

  const preview = useMemo(() => {
    if (!outcome || !Number.isFinite(pricePerTicket) || pricePerTicket <= 0)
      return null;
    const isVoid = outcome === "VOID";
    const winningTickets = isVoid ? 0 : totals.ticketsByOutcome[outcome];
    const refundAll = isVoid || winningTickets === 0;
    const perTicketCents = refundAll
      ? Math.round(pricePerTicket * 100)
      : Math.floor(totals.distributableCents / winningTickets);
    const projectedWinnerTotalCents = rows.reduce((sum, r) => {
      const winningForSale = isVoid ? 0 : r.byOutcome[outcome as "A" | "B" | "C"];
      const payout = refundAll
        ? Math.round(pricePerTicket * r.tickets * 100)
        : perTicketCents * winningForSale;
      return sum + payout;
    }, 0);
    return {
      refundAll,
      perTicketCents,
      winningTickets,
      projectedWinnerTotalCents,
    };
  }, [outcome, totals, rows, pricePerTicket]);

  const handleSettle = async () => {
    if (!outcome || !confirmed || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSettleResponse(null);
    try {
      const res = await authedApiFetch("settleBet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betId: bet.id, result: outcome }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      setSettleResponse({ status: res.status, ...data });
      if (!res.ok) {
        setSubmitError(
          (data.message as string) || `Error del servidor (${res.status})`
        );
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error inesperado al liquidar"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const settledOk =
    settleResponse !== null &&
    (settleResponse.alreadySettled === true ||
      (settleResponse.status === 200 && !submitError));

  return (
    <div className="w-full max-w-5xl">
      <button
        onClick={onBack}
        className="mb-4 px-3 py-1.5 text-sm rounded-card bg-gray-200 text-gray-800 hover:bg-gray-300"
      >
        ← Otra apuesta
      </button>

      <div className="bg-white rounded-card border border-ink-100 shadow-card p-4 mb-4">
        <h2 className="text-lg font-bold text-ink-900">{bet.title || bet.id}</h2>
        <p className="text-sm text-ink-500">
          {bet.teams?.a} vs {bet.teams?.b} — {formatDate(bet.date)} ·{" "}
          {formatPrice(bet.pricePerTicket)} por boleto
        </p>
        {bet.settled === true && (
          <p className="mt-2 text-sm px-3 py-2 rounded-sm bg-success-700 text-white">
            ✓ Esta apuesta ya está liquidada
            {bet.result ? ` (resultado ${bet.result})` : ""}. settleBet es
            idempotente: un nuevo intento no cambiará nada.
          </p>
        )}
      </div>

      {error ? (
        <ApiErrorState kind={error.kind} message={error.message} onRetry={loadSales} entityLabel="ventas de apuestas" />
      ) : sales === null ? (
        <div className="flex justify-center items-center w-full h-40">
          <FadeLoader color="var(--color-brand-700)" />
        </div>
      ) : (
        <>
          {/* Pool summary */}
          <div className="bg-white rounded-card border border-ink-100 shadow-card p-4 mb-4 text-sm">
            <p className="font-semibold text-ink-900 mb-2">
              Resumen del pool (ventas verificadas)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <p>
                Boletos:{" "}
                <span className="font-semibold">
                  {totals.totalTickets}
                </span>{" "}
                (A {totals.ticketsByOutcome.A} / B {totals.ticketsByOutcome.B} / C{" "}
                {totals.ticketsByOutcome.C})
              </p>
              <p>
                Pool:{" "}
                <span className="font-semibold">
                  {formatPrice((totals.poolCents / 100).toFixed(2))}
                </span>
              </p>
              <p>
                Tasa de la casa ({(TAKE_RATE * 100).toFixed(0)}%):{" "}
                <span className="font-semibold">
                  {formatPrice((totals.takeCents / 100).toFixed(2))}
                </span>
              </p>
              <p>
                A repartir:{" "}
                <span className="font-semibold">
                  {formatPrice((totals.distributableCents / 100).toFixed(2))}
                </span>
              </p>
            </div>
            <p className="text-xs text-ink-500 mt-2">
              Cálculo espejo de settleBet sobre los documentos de venta
              verificados. La tasa mostrada es el valor por defecto (10%);
              settleBet lee el valor real desde Remote Config. El cálculo
              oficial lo ejecuta settleBet al liquidar.
            </p>
          </div>

          {/* Payout list */}
          <div className="bg-white rounded-card border border-ink-100 shadow-card p-4 mb-4 overflow-x-auto">
            <p className="font-semibold text-ink-900 mb-2 text-sm">
              Lista de pagos ({rows.length} ventas)
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-ink-500">
                No hay ventas verificadas con boletos para esta apuesta.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-500 border-b border-ink-200">
                    <th className="py-2 pr-4">Comprador</th>
                    <th className="py-2 pr-4">Boletos</th>
                    <th className="py-2 pr-4">Jugada</th>
                    <th className="py-2 pr-4">Ganador: pago</th>
                    <th className="py-2 pr-4">Perdedor: pago</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const picks = [
                      r.byOutcome.A > 0 ? `A ×${r.byOutcome.A}` : null,
                      r.byOutcome.B > 0 ? `B ×${r.byOutcome.B}` : null,
                      r.byOutcome.C > 0 ? `Empate ×${r.byOutcome.C}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    const winnerPayout =
                      preview && !preview.refundAll && outcome
                        ? preview.perTicketCents * r.byOutcome[outcome as "A" | "B" | "C"]
                        : preview && preview.refundAll
                        ? Math.round(pricePerTicket * r.tickets * 100)
                        : null;
                    return (
                      <tr key={r.saleId} className="border-b border-ink-100">
                        <td className="py-2 pr-4">
                          <span className="font-medium text-ink-900">
                            {r.name || "(sin nombre)"}
                          </span>
                          {r.email && (
                            <span className="block text-xs text-ink-500">
                              {r.email}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{r.tickets}</td>
                        <td className="py-2 pr-4">{picks}</td>
                        <td className="py-2 pr-4 text-success-700 font-semibold">
                          {winnerPayout != null
                            ? formatPrice((winnerPayout / 100).toFixed(2))
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-ink-500">$0.00</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Confirm gate — the only path to settleBet */}
          <div className="bg-white rounded-card border border-ink-100 shadow-card p-4 mb-4">
            <p className="font-semibold text-ink-900 mb-2 text-sm">
              Resultado oficial (mismo parámetro que acepta settleBet)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(["A", "B", "C", "VOID"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setOutcome(o);
                    setConfirmed(false);
                    setSubmitError(null);
                  }}
                  className={`py-2 px-3 rounded-sm border text-sm font-semibold transition-colors ${
                    outcome === o
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-ink-900 border-ink-300 hover:bg-ink-100"
                  }`}
                >
                  {OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>

            {preview && (
              <div className="rounded-sm border border-ink-200 bg-ink-100 p-3 text-sm mb-4">
                {preview.refundAll ? (
                  <p className="text-ink-700">
                    Reembolso total: cada boleto recupera su apuesta completa (
                    {formatPrice(pricePerTicket)}). Sin ganancias para la banca.
                  </p>
                ) : (
                  <p className="text-ink-700">
                    Pago por boleto ganador:{" "}
                    <strong>
                      {formatPrice((preview.perTicketCents / 100).toFixed(2))}
                    </strong>{" "}
                    ({preview.winningTickets} boletos ganadores). Total proyectado
                    a ganadores:{" "}
                    <strong>
                      {formatPrice(
                        (preview.projectedWinnerTotalCents / 100).toFixed(2)
                      )}
                    </strong>
                    .
                  </p>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-ink-700 mb-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="accent-brand-600"
                disabled={!outcome || isSubmitting}
              />
              Confirmo el resultado y entiendo que la liquidación es definitiva
              e idempotente.
            </label>

            <button
              type="button"
              onClick={handleSettle}
              disabled={!outcome || !confirmed || isSubmitting}
              className="w-full py-3 px-4 bg-danger-700 text-white rounded-sm hover:bg-danger-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {isSubmitting
                ? "Procesando…"
                : preview
                ? `Liquidar (${OUTCOME_LABELS[preview.refundAll ? "VOID" : outcome!]} — ${formatPrice((preview.projectedWinnerTotalCents / 100).toFixed(2))} a ganadores)`
                : "Liquidar"}
            </button>
            <p className="text-xs text-ink-500 mt-2">
              Nada se liquida al navegar o recargar: settleBet solo se invoca con
              este botón. No hay opción de liquidar sin notificaciones —
              settleBet siempre encola las notificaciones de liquidación
              (pendiente como mejora en el backlog).
            </p>

            {submitError && (
              <div
                role="alert"
                className="mt-3 px-3 py-2 rounded-sm bg-danger-100 border border-danger-500 text-danger-700 text-sm"
              >
                {submitError}
              </div>
            )}

            {settleResponse && (
              <div
                role="status"
                className="mt-3 px-3 py-2 rounded-sm border border-ink-300 bg-ink-100 text-sm"
              >
                {settledOk ? (
                  <p className="mb-2 font-semibold text-success-700">
                    {settleResponse.alreadySettled
                      ? "La apuesta ya estaba liquidada; no se aplicó ningún cambio."
                      : "Liquidación aplicada."}
                  </p>
                ) : (
                  <p className="mb-2 font-semibold text-danger-700">
                    La liquidación no se completó (revisa el error arriba).
                  </p>
                )}
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(settleResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}