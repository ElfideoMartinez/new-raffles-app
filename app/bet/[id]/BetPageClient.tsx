"use client";
import OfferStar from "@/app/components/OfferStar";
import useTicketStore from "@/app/store";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { realtimeDB } from "@/app/firebaseconfig";
import { ref, onValue, off } from "firebase/database";

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
          ? "border-gray-300 bg-gray-100 text-gray-800"
          : "border-yellow-400 bg-yellow-50 text-yellow-900"
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

  // Loading state
  const [loading, setLoading] = useState(true);

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
    if (!betId) return;

    const betRef = ref(realtimeDB, `bets/${betId}`);
    const unsubscribe = onValue(
      betRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log("Real-time bet data update:", data);
        if (data) {
          setRealtimeBetData(data);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error listening to bet updates:", error);
        setLoading(false);
      }
    );

    // Cleanup function
    return () => {
      off(betRef, "value", unsubscribe);
    };
  }, [betId]);

  // Optimized ticket update function
  const updateTickets = useCallback(
    (team: "A" | "B" | "C", action: number) => {
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
    [realtimeBetData.teams]
  );

  const addToCart = useCallback(() => {
    if (totalTickets === 0 || priceUnusable) return;

    updateBet({
      betId: betId as string,
      betName: realtimeBetData.title,
      team: selectedTeam,
      letterTeam: selectedLetterTeam,
      ticketNumbers: totalTickets,
      totalPrice: totalPrice,
    });

    console.log("Cart updated:", userCartBets());
    router.push("/user/cart");
  }, [
    betId,
    realtimeBetData.title,
    selectedTeam,
    selectedLetterTeam,
    totalTickets,
    totalPrice,
    updateBet,
    userCartBets,
    priceUnusable,
    router,
  ]);

  // Team card component for better organization
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
      <div
        className={`flex w-full sm:w-1/2 flex-col items-center justify-between rounded-card text-white shadow cursor-pointer transition p-4 ${color}
        ${
          disabled
            ? "bg-gray-500 hover:bg-gray-500 opacity-50 pointer-events-none"
            : ""
        }`}
        onClick={() => updateTickets(teamKey, 1)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            updateTickets(teamKey, 1);
          }
        }}
      >
        {teamKey !== "C" && (
          <p className=''>
            {favorite === "Equals"
              ? `Empate: ${stakeShare}%`
              : `${
                  teamName === favorite ? "Favorito: " : "Menos favorito: "
                } ${stakeShare}%`}
          </p>
        )}

        {teamKey === "C" && <p className=''>Empate: {stakeShare}%</p>}

        <button className='w-full py-4 text-xl font-bold cursor-pointer'>
          {emoji} {teamName}
        </button>

        {/* Ticket Selector */}
        <div className='flex items-center gap-2 mt-4 mb-1'>
          <button
            className={`bg-white rounded-pill w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-gray-200 ${
              teamKey === "A"
                ? "text-green-700"
                : teamKey === "B"
                ? "text-red-700"
                : "text-gray-700"
            }`}
            disabled={tickets === 0}
            onClick={(e) => {
              updateTickets(teamKey, -1);
              e.stopPropagation();
            }}
          >
            −
          </button>
          <span className='text-lg font-semibold'>{tickets}</span>
        </div>

        <div className='mt-2 bg-yellow-300 text-green-900 rounded-sm px-3 py-1 text-sm font-semibold text-center'>
          Pagas ${realtimeBetData.pricePerTicket} — si gana {teamName} te
          llevas ~${estimatedPayout.toFixed(2)}
          <span className='block text-xs font-normal'>(estimado)</span>
        </div>
      </div>
    );
  };

  return (
    <div className='flex min-h-screen flex-col items-center bg-gray-100 p-4 text-gray-800'>
      {loading ? (
        <div className='flex justify-center items-center h-96'>
          <div className='animate-spin rounded-pill h-16 w-16 border-b-2 border-blue-600'></div>
        </div>
      ) : (
        <>
          {/* Main Image */}
          <img
            className='mb-6 h-[33vh] w-full rounded-card bg-cover bg-center shadow-lg'
            src={realtimeBetData.image}
            alt={realtimeBetData.title}
          />

          {/* Settled result: winner + payout, or refund notice. */}
          <WinnerBanner
            result={realtimeBetData.result}
            teams={realtimeBetData.teams}
            payoutPerTicket={realtimeBetData.payoutPerTicket}
            settled={realtimeBetData.settled}
          />

          {/* Title and Description */}
          <h1 className='mb-2 text-xl font-bold text-center'>
            🏆 ¡Haz tu apuesta ahora!
          </h1>
          <h1 className='mb-2 text-3xl font-bold text-center'>
            {realtimeBetData.title}
          </h1>
          <h2 className='mb-3 text-xl font-bold text-center'>
            {realtimeBetData.description}
          </h2>
          <p className='mb-4 text-center text-sm text-gray-600'>
            Apuesta por tu equipo favorito y gana
          </p>

          {/* Price Star */}
          <motion.div
            className='fixed mb-2 top-40 left-1 cursor-pointer'
            drag
            dragMomentum={false}
          >
            <OfferStar text={realtimeBetData.pricePerTicket.toString()} />
          </motion.div>

          {/* Team Selection Cards */}
          <div
            className={`flex w-full sm:max-w-4xl items-center flex-col md:flex-row justify-center gap-6 ${
              realtimeBetData.isFinished ? "pointer-events-none opacity-40" : ""
            }`}
          >
            {/* Team A */}
            <TeamCard
              teamKey='A'
              teamName={realtimeBetData.teams.a}
              color='bg-green-600 hover:bg-green-700'
              emoji='⚪'
              tickets={ticketsTeamA}
              stakeShare={stakeSharePercent("A")}
              disabled={ticketsTeamB > 0 || tieTickets > 0}
            />

            {/* Tie */}
            <TeamCard
              teamKey='C'
              teamName='Empate'
              color='bg-gray-600 hover:bg-gray-700'
              emoji=''
              tickets={tieTickets}
              stakeShare={stakeSharePercent("C")}
              disabled={ticketsTeamA > 0 || ticketsTeamB > 0}
            />

            {/* Team B */}
            <TeamCard
              teamKey='B'
              teamName={realtimeBetData.teams.b}
              color='bg-red-600 hover:bg-red-700'
              emoji='🔴'
              tickets={ticketsTeamB}
              stakeShare={stakeSharePercent("B")}
              disabled={ticketsTeamA > 0 || tieTickets > 0}
            />
          </div>

          {/* Warning Message */}
          <p className='mt-4 mb-3 text-center text-sm text-gray-500'>
            ⚠️ Las ganancias pueden cambiar según nuevas apuestas antes del
            cierre
          </p>

          {/* Bottom Cart Bar */}
          <div className='w-full bg-blue-600 shadow-lg flex sm:flex-row justify-between sm:items-center px-4 py-4 fixed bottom-0'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:gap-2'>
              <span className='text-white font-bold text-lg'>
                Total: ${totalPrice}
              </span>
              <span className='text-white font-semibold'>
                🎟️ <span id='cartTickets'>{totalTickets}</span> boletos
              </span>
              <div>
                <span className='text-white font-semibold text-base text-start'>
                  🏆 Gana hasta (estimado):{" "}
                  <span id='cartWinnings' className='ml-8 sm:ml-0'>
                    ~$
                    {potentialWinnings.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
            <div className='flex justify-start'>
              <button
                className='bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-4 mt-2 sm:mt-0 py-2 rounded-card shadow transition text-base sm:text-lg disabled:opacity-50
                disabled:hover:bg-yellow-400 disabled:cursor-not-allowed'
                disabled={totalTickets === 0 || priceUnusable}
                onClick={addToCart}
              >
                Agregar al carrito
              </button>
            </div>
          </div>
          {priceUnusable && (
            <p className='fixed bottom-20 sm:bottom-16 w-full text-center text-sm font-semibold text-red-700'>
              Esta apuesta no está disponible por ahora.
            </p>
          )}
          <div className='h-36 sm:h-16'></div>
        </>
      )}
    </div>
  );
};

export default BetPageClient;
