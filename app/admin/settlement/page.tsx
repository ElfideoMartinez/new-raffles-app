"use client";
// Admin settlement review + confirm screen (ratified 2026-10-25).
//
// Shows the payout list BEFORE anything settles. The ONLY action that touches
// settleBet is one explicit "Liquidar" confirm button; nothing settles on
// navigation, timers, or auto-refresh.
//
// Payouts are computed client-side from live verified salesBets docs —
// mirroring settleBet's maths — inside SettlementReview.tsx. The authoritative
// maths still runs in settleBet; the take rate there is Remote Config's, the
// preview uses the documented default (10%) and says so in the UI.
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { FadeLoader } from "react-spinners";
import { realtimeDB } from "@/app/firebaseconfig";
import { formatDate, formatPrice } from "@/app/utils/format";
import withAuth from "@/app/components/WithAuth";
import { SettlementReview } from "./SettlementReview";

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

export default function SettlementPage() {
  const [bets, setBets] = useState<IBetsData[]>([]);
  const [betsLoading, setBetsLoading] = useState(true);
  const [betsError, setBetsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bets come from RTDB (live source for admin-created bets, same as /admin/bets).
  useEffect(() => {
    const betsRef = ref(realtimeDB, "bets");
    const unsubscribe = onValue(
      betsRef,
      (snapshot) => {
        const data = snapshot.val();
        const list: IBetsData[] = data
          ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
          : [];
        setBets(list);
        setBetsLoading(false);
        setBetsError(null);
      },
      (err) => {
        console.error("Error loading bets:", err);
        setBetsError("No se pudieron cargar las apuestas.");
        setBetsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const selected = useMemo(
    () => bets.find((b) => (b as { id?: string }).id === selectedId) ?? null,
    [bets, selectedId]
  );

  return (
    <div className="flex flex-col w-full items-center px-4">
      <h1 className="my-1 text-xl font-bold">Liquidación de apuestas</h1>
      {betsLoading ? (
        <div className="flex justify-center items-center w-full h-64">
          <FadeLoader color="var(--color-brand-700)" />
        </div>
      ) : betsError ? (
        <p role="alert" className="text-danger-700 text-sm my-4">
          {betsError}
        </p>
      ) : selected ? (
        <SettlementReview
          bet={selected as IBetsData & { id: string }}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <BetSelector
          bets={bets as (IBetsData & { id: string })[]}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}

function BetSelector({
  bets,
  onSelect,
}: {
  bets: (IBetsData & { id: string })[];
  onSelect: (id: string) => void;
}) {
  const sorted = [...bets].sort((a, b) => {
    // Unsettled first, then finished, then newest close date.
    if (!!a.settled !== !!b.settled) return a.settled ? 1 : -1;
    if (a.isFinished !== b.isFinished) return a.isFinished ? -1 : 1;
    return (b.date || "").localeCompare(a.date || "");
  });

  return (
    <div className="w-full max-w-3xl">
      <p className="text-sm text-ink-500 mb-4">
        Selecciona una apuesta para revisar la lista de pagos antes de
        liquidar. Aquí no se liquida nada automáticamente.
      </p>
      {sorted.length === 0 ? (
        <p className="text-ink-500 text-sm">No hay apuestas registradas.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((bet) => {
            const price = parseFloat(bet.pricePerTicket);
            const tickets =
              Number(
                (bet as { betsTeamA?: unknown }).betsTeamA ?? 0
              ) +
              Number((bet as { betsTeamB?: unknown }).betsTeamB ?? 0) +
              Number(bet.tieBets ?? 0);
            return (
              <li key={bet.id}>
                <button
                  onClick={() => onSelect(bet.id)}
                  className="w-full text-left bg-surface rounded-card border border-ink-100 shadow-card hover:shadow-card-hover transition-shadow p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2 items-center">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {bet.title || bet.id}
                      </p>
                      <p className="text-xs text-ink-500">
                        {bet.teams?.a} vs {bet.teams?.b} —{" "}
                        {formatDate(bet.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {bet.settled === true ? (
                        <span className="px-2 py-1 rounded-pill bg-success-700 text-white">
                          ✓ Liquidada{bet.result ? ` (${bet.result})` : ""}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-pill ${
                            bet.isFinished
                              ? "bg-danger-700 text-white"
                              : "bg-warning-500 text-ink-900"
                          }`}
                        >
                          {bet.isFinished ? "Finalizada" : "Activa"}
                        </span>
                      )}
                      <span className="text-ink-700">
                        {tickets > 0
                          ? `${tickets} boletos · ${formatPrice(
                              (Number.isFinite(price) ? price : 0) * tickets
                            )}`
                          : "Sin boletos"}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}