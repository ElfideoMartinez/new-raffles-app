"use client";
import BackLink from "@/app/components/BackLink";
import useTicketStore from "@/app/store";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { realtimeDB } from "@/app/firebaseconfig";
import { ref, onValue } from "firebase/database";
import { isBetClosed } from "@/app/utils/betStatus";

interface BetRealtimeData {
  oddsTie: any;
  betsTeamA: number;
  betsTeamB: number;
  createdAt: string;
  date: string;
  description: string;
  firestoreId: string;
  image: string;
  initialPool: number;
  isFinished: boolean;
  oddsTeamA: string;
  oddsTeamB: string;
  pricePerTicket: number;
  teams: {
    a: string;
    b: string;
  };
  tieBets: number;
  title: string;
  // Written by settleBet() when an admin settles the match.
  settled?: boolean;
  result?: "A" | "B" | "C" | "VOID" | string;
  payoutPerTicket?: number;
  totalTickets?: number;
  pool?: number;
}

/**
 * Settled-match banner.
 *
 * settleBet() writes { settled, result, payoutPerTicket, pool } to the bet.
 * Before this, a finished bet only greyed out the selection cards, so a visitor
 * could not tell who won or what a winning ticket paid. `result` is the outcome
 * letter: A/B are the two fighters, C is the draw, VOID means refunded.
 */
function WinnerBanner({
  result,
  teams,
  payoutPerTicket,
  settled,
}: {
  result?: string;
  teams: { a: string; b: string };
  payoutPerTicket?: number;
  settled?: boolean;
}) {
  if (!settled && !result) return null;

  const label =
    result === "A"
      ? teams.a
      : result === "B"
      ? teams.b
      : result === "C"
      ? "Empate"
      : null;

  const isVoid = result === "VOID";

  return (
    <div
      role='status'
      className={`mb-4 w-full max-w-2xl rounded-card border p-4 text-center ${
        isVoid
          ? "border-ink-300 bg-ink-100 text-ink-700"
          : "border-warning-500 bg-warning-50 text-warning-700"
      }`}
    >
      {isVoid ? (
        <p className='font-bold'>Apuesta anulada: se reembolsa el importe completo.</p>
      ) : label ? (
        <>
          <p className='text-sm uppercase tracking-wide'>Resultado oficial</p>
          <p className='text-xl font-bold'>🏆 Ganador: {label}</p>
        </>
      ) : (
        <p className='font-bold'>Apuesta finalizada.</p>
      )}
      {typeof payoutPerTicket === "number" && payoutPerTicket > 0 && !isVoid ? (
        <p className='mt-1 text-sm'>
          Pago por boleto ganador: ${payoutPerTicket.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}

const BetPageClient = ({ betId }: { betId: string | null }) => {
  const router = useRouter();
  const { updateBet } = useTicketStore();
  const userCartBets = useTicketStore((state) => state.getBetsFromCart);
  const userTicketsBets = useTicketStore((state) => state.getTicketInfoByBetId);

  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  // Real-time bet data state
  const [realtimeBetData, setRealtimeBetData] = useState<BetRealtimeData>({
    betsTeamA: 0,
    betsTeamB: 0,
    createdAt: "",
    date: "",
    description: "",
    firestoreId: "",
    image: "",
    initialPool: 0,
    isFinished: false,
    oddsTeamA: "",
    oddsTeamB: "",
    pricePerTicket: 0,
    teams: {
      a: "",
      b: "",
    },
    tieBets: 0,
    title: "",
    oddsTie: "",
  });

  const closed = isBetClosed(realtimeBetData);

  // User selection state
  const [ticketsTeamA, setTicketsTeamA] = useState(0);
  const [ticketsTeamB, setTicketsTeamB] = useState(0);
  const [tieTickets, setTieTickets] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedLetterTeam, setSelectedLetterTeam] = useState("");

  // Computed values using useMemo for performance
  const favorite = useMemo(() => {
    if (realtimeBetData.betsTeamA === realtimeBetData.betsTeamB) {
      return "Equals";
    }
    return realtimeBetData.betsTeamA > realtimeBetData.betsTeamB
      ? realtimeBetData.teams.a
      : realtimeBetData.teams.b;
  }, [
    realtimeBetData.betsTeamA,
    realtimeBetData.betsTeamB,
    realtimeBetData.teams,
  ]);

  const totalTickets = useMemo(() => {
    return ticketsTeamA + ticketsTeamB + tieTickets;
  }, [ticketsTeamA, ticketsTeamB, tieTickets]);

  const totalPrice = useMemo(() => {
    return realtimeBetData.pricePerTicket * totalTickets;
  }, [realtimeBetData.pricePerTicket, totalTickets]);

  // B4: a $0 / non-numeric price means the bet is unusable — block the cart
  // path instead of silently selling at $0.
  const priceUnusable = useMemo(() => {
    const p = Number(realtimeBetData.pricePerTicket);
    return !Number.isFinite(p) || p <= 0;
  }, [realtimeBetData.pricePerTicket]);

  // ---- Pari-mutuel ESTIMATE (DESIGN-AUDIT.md B2, Option A) ----
  // Same formula shape as the server's single source of truth
  // (functions/src/payout.ts): every ticket stakes pricePerTicket into one
  // pool; pool × (1 − take) is split equally among the winning outcome's
  // tickets. These numbers are ESTIMATES only — settlement is server-side
  // and authoritative. Never display fixed-odds / American odds here.
  const TAKE_RATE = 0.1; // keep in sync with Remote Config `betsTakeRate`

  const estimatedMultiplier = useCallback(
    (team: "A" | "B" | "C") => {
      const { betsTeamA, betsTeamB, tieBets, pricePerTicket } = realtimeBetData;
      const outcomeTickets =
        team === "A" ? betsTeamA : team === "B" ? betsTeamB : tieBets;
      const totalSold = betsTeamA + betsTeamB + tieBets;
      const pool = totalSold * pricePerTicket;
      const distributable = pool * (1 - TAKE_RATE);
      if (outcomeTickets > 0) {
        return distributable / (outcomeTickets * pricePerTicket);
      }
      // No tickets on this outcome yet: one ticket would take the whole
      // distributable pool. Zero pool means nothing to win yet.
      return pool > 0 ? distributable / pricePerTicket : 0;
    },
    [realtimeBetData]
  );

  const estimateWinnings = useCallback(
    (team: "A" | "B" | "C", tickets: number) => {
      if (tickets === 0) return 0;
      return estimatedMultiplier(team) * tickets * realtimeBetData.pricePerTicket;
    },
    [estimatedMultiplier, realtimeBetData.pricePerTicket]
  );

  const potentialWinnings = useMemo(() => {
    if (ticketsTeamA > 0) return estimateWinnings("A", ticketsTeamA);
    if (ticketsTeamB > 0) return estimateWinnings("B", ticketsTeamB);
    if (tieTickets > 0) return estimateWinnings("C", tieTickets);
    return 0;
  }, [ticketsTeamA, ticketsTeamB, tieTickets, estimateWinnings]);

  // Stake-share percentage shown on each team card (no American odds).
  const stakeSharePercent = useCallback(
    (team: "A" | "B" | "C") => {
      const { betsTeamA, betsTeamB, tieBets } = realtimeBetData;
      const totalSold = betsTeamA + betsTeamB + tieBets;
      if (totalSold === 0) return 0;
      const outcomeTickets =
        team === "A" ? betsTeamA : team === "B" ? betsTeamB : tieBets;
      return Math.round((outcomeTickets / totalSold) * 100);
    },
    [realtimeBetData]
  );

  // Real-time database listener
  useEffect(() => {
    if (!betId) {
      setLoadStatus("missing");
      return;
    }

    setLoadStatus("loading");
    const betRef = ref(realtimeDB, `bets/${betId}`);
    return onValue(
      betRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setRealtimeBetData(data);
          setLoadStatus("ready");
        } else {
          setLoadStatus("missing");
        }
      },
      (error) => {
        console.error("Error listening to bet updates:", error);
        setLoadStatus("error");
      }
    );

  }, [betId]);

  // Optimized ticket update function
  const updateTickets = useCallback(
    (team: "A" | "B" | "C", action: number) => {
      if (closed) return;
      // Reset other teams when selecting a new one
      if (action > 0) {
        if (team !== "A") setTicketsTeamA(0);
        if (team !== "B") setTicketsTeamB(0);
        if (team !== "C") setTieTickets(0);
      }

      switch (team) {
        case "A":
          setTicketsTeamA((prev) => Math.max(0, prev + action));
          if (action > 0) {
            setSelectedTeam(realtimeBetData.teams.a);
            setSelectedLetterTeam("A");
          }
          break;
        case "B":
          setTicketsTeamB((prev) => Math.max(0, prev + action));
          if (action > 0) {
            setSelectedTeam(realtimeBetData.teams.b);
            setSelectedLetterTeam("B");
          }
          break;
        case "C":
          setTieTickets((prev) => Math.max(0, prev + action));
          if (action > 0) {
            setSelectedTeam("Empate");
            setSelectedLetterTeam("C");
          }
          break;
      }
    },
    [closed, realtimeBetData.teams]
  );

  const addToCart = useCallback(() => {
    if (closed || totalTickets === 0 || priceUnusable) return;

    updateBet({
      betId: betId as string,
      betName: realtimeBetData.title,
      team: selectedTeam,
      letterTeam: selectedLetterTeam,
      ticketNumbers: totalTickets,
      totalPrice: totalPrice,
      image: realtimeBetData.image || undefined,
    });

    router.push("/user/cart");
  }, [
    betId,
    closed,
    realtimeBetData.title,
    selectedTeam,
    selectedLetterTeam,
    totalTickets,
    totalPrice,
    updateBet,
    realtimeBetData.image,
    userCartBets,
    priceUnusable,
    router,
  ]);

  // Keep selection and quantity controls as sibling buttons so touch and
  // keyboard users never encounter nested interactive controls.
  const TeamCard = ({
    teamKey,
    teamName,
    color,
    emoji,
    tickets,
    stakeShare,
    disabled,
  }: {
    teamKey: "A" | "B" | "C";
    teamName: string;
    color: string;
    emoji: string;
    tickets: number;
    stakeShare: number;
    disabled: boolean;
  }) => {
    const estimatedPayout = estimateWinnings(teamKey, tickets);
    if (teamKey === "C" && realtimeBetData.oddsTie) {
      return null;
    }

    return (
      <section
        aria-label={`Apuesta por ${teamName}`}
        className={`flex w-full flex-col rounded-card p-4 text-white shadow-card transition-colors sm:max-w-sm ${color} ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {teamKey !== "C" ? (
          <p className="text-center text-sm font-medium">
            {favorite === "Equals"
              ? `Empate: ${stakeShare}%`
              : `${teamName === favorite ? "Favorito" : "Menos favorito"}: ${stakeShare}%`}
          </p>
        ) : (
          <p className="text-center text-sm font-medium">Empate: {stakeShare}%</p>
        )}

        <button
          type="button"
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-sm bg-black/10 px-3 py-2 text-center text-lg font-bold hover:bg-black/20 disabled:cursor-not-allowed"
          aria-label={`${tickets > 0 ? "Agregar otro boleto para" : "Elegir"} ${teamName}`}
          aria-pressed={tickets > 0}
          disabled={disabled}
          onClick={() => updateTickets(teamKey, 1)}
        >
          {emoji ? `${emoji} ` : ""}{teamName}
        </button>

        <div className="mt-3 flex items-center justify-center gap-4" aria-label={`Boletos para ${teamName}`}>
          <button
            type="button"
            className="h-11 w-11 rounded-pill bg-surface text-2xl font-bold text-ink-900 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Quitar un boleto de ${teamName}`}
            disabled={closed || tickets === 0}
            onClick={() => updateTickets(teamKey, -1)}
          >
            −
          </button>
          <output className="min-w-8 text-center text-xl font-bold" aria-live="polite">
            {tickets}
          </output>
          <button
            type="button"
            className="h-11 w-11 rounded-pill bg-surface text-2xl font-bold text-ink-900 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Agregar un boleto de ${teamName}`}
            disabled={disabled}
            onClick={() => updateTickets(teamKey, 1)}
          >
            +
          </button>
        </div>

        {!closed && (
          <p className="mt-3 rounded-sm bg-warning-500 px-3 py-2 text-center text-sm font-semibold text-success-700">
            Cada boleto cuesta ${realtimeBetData.pricePerTicket}. Si gana {teamName},
            recibirías aproximadamente ${estimatedPayout.toFixed(2)}.
            <span className="block text-xs font-normal">Estimación; puede cambiar antes del cierre.</span>
          </p>
        )}
      </section>
    );
  };

  return (
    <main className="-mx-4 flex min-h-screen flex-col items-center bg-ink-100 px-4 pb-[calc(13rem+env(safe-area-inset-bottom))] pt-4 text-ink-900 sm:mx-0 sm:rounded-card sm:px-6 sm:pb-36">
      <BackLink href="/bet" label="Volver a Apuestas" />
      {loadStatus === "loading" ? (
        <div role="status" aria-label="Cargando apuesta" className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-pill border-4 border-ink-200 border-b-brand-600" />
        </div>
      ) : loadStatus !== "ready" ? (
        <div className="w-full max-w-md rounded-card border border-ink-100 bg-surface p-6 text-center shadow-card">
          <h1 className="text-lg font-bold">
            {loadStatus === "missing" ? "No encontramos esta apuesta" : "No se pudo cargar la apuesta"}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            {loadStatus === "missing" ? "Vuelve a la lista para ver otras apuestas." : "Intenta de nuevo en un momento."}
          </p>
        </div>
      ) : (
        <>
          <img
            className="mb-5 aspect-video max-h-72 w-full max-w-4xl rounded-card bg-ink-100 object-cover shadow-card"
            src={realtimeBetData.image}
            alt={realtimeBetData.title}
          />

          <WinnerBanner
            result={realtimeBetData.result}
            teams={realtimeBetData.teams}
            payoutPerTicket={realtimeBetData.payoutPerTicket}
            settled={realtimeBetData.settled}
          />

          <div className="mb-5 w-full max-w-4xl text-center">
            <p className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-700">
              {closed ? "Apuesta finalizada" : "Elige un resultado"}
            </p>
            <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              {realtimeBetData.title}
            </h1>
            <p className="mt-2 text-base font-semibold text-ink-700 sm:text-lg">
              {realtimeBetData.description}
            </p>
            {!closed && (
              <p className="mt-2 text-sm text-ink-500">
                Elige un equipo y agrega boletos. El pago potencial es estimado.
              </p>
            )}
            <div className="mx-auto mt-4 inline-flex min-h-11 items-center rounded-pill border border-brand-100 bg-surface px-5 text-sm font-semibold text-ink-900 shadow-sm">
              Precio por boleto: ${realtimeBetData.pricePerTicket}
            </div>
          </div>

          {/* Team Selection Cards */}
          <div
            className={`grid w-full max-w-5xl grid-cols-1 items-stretch justify-center gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 ${
              closed ? "opacity-40" : ""
            }`}
          >
            {/* Team A */}
            <TeamCard
              teamKey='A'
              teamName={realtimeBetData.teams.a}
              color='bg-success-700 hover:bg-success-700'
              emoji='⚪'
              tickets={ticketsTeamA}
              stakeShare={stakeSharePercent("A")}
              disabled={closed || ticketsTeamB > 0 || tieTickets > 0}
            />

            {/* Tie */}
            <TeamCard
              teamKey='C'
              teamName='Empate'
              color='bg-ink-500 hover:bg-ink-700'
              emoji=''
              tickets={tieTickets}
              stakeShare={stakeSharePercent("C")}
              disabled={closed || ticketsTeamA > 0 || ticketsTeamB > 0}
            />

            {/* Team B */}
            <TeamCard
              teamKey='B'
              teamName={realtimeBetData.teams.b}
              color='bg-danger-700 hover:bg-danger-700'
              emoji='🔴'
              tickets={ticketsTeamB}
              stakeShare={stakeSharePercent("B")}
              disabled={closed || ticketsTeamA > 0 || tieTickets > 0}
            />
          </div>

          <p hidden={closed} className="mx-auto mt-4 max-w-3xl text-center text-sm text-ink-500">
            Las ganancias estimadas pueden cambiar según las apuestas que se reciban antes del cierre.
          </p>

          <section
            hidden={closed}
            aria-label="Resumen de apuesta"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/90 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
                <div className="flex items-baseline justify-between gap-3 sm:justify-start sm:gap-6">
                  <p className="text-lg font-extrabold text-ink-900">
                    Total: ${totalPrice}
                  </p>
                  <p className="font-semibold text-ink-700">
                    {totalTickets} {totalTickets === 1 ? "boleto" : "boletos"}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-ink-600">
                  Pago potencial estimado: <span className="font-bold">~${potentialWinnings.toFixed(2)}</span>
                </p>
                {priceUnusable && (
                  <p className="mt-1 text-sm font-semibold text-danger-700" role="status">
                    Esta apuesta no está disponible por ahora.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="min-h-12 w-full shrink-0 rounded-pill bg-warning-500 px-6 py-3 text-base font-bold text-brand-700 shadow-sm transition hover:bg-warning-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-lg"
                disabled={closed || totalTickets === 0 || priceUnusable}
                onClick={addToCart}
              >
                Agregar al carrito
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default BetPageClient;