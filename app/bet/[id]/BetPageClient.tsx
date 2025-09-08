"use client";
import OfferStar from "@/app/components/OfferStar";
import useTicketStore from "@/app/store";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { realtimeDB } from "@/app/firebaseconfig";
import { ref, onValue, off } from "firebase/database";

interface BetRealtimeData {
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

  // Optimized gain calculation
  const calculateGain = useCallback(
    (numberOfTickets: number, team: "A" | "B" | "C") => {
      if (numberOfTickets === 0) return 0;

      const { betsTeamA, betsTeamB, tieBets } = realtimeBetData;
      const totalBets = betsTeamA + betsTeamB + tieBets;
      let winPerTicket = 0;

      switch (team) {
        case "A":
          winPerTicket = betsTeamA === 0 ? totalBets : totalBets / betsTeamA;
          break;
        case "B":
          winPerTicket =
            betsTeamB === 0 ? totalBets : totalBets / betsTeamB + betsTeamB;
          break;
        case "C":
          winPerTicket =
            tieBets === 0 ? totalBets : totalBets / tieBets + tieBets;
          break;
      }

      return winPerTicket * numberOfTickets;
    },
    [realtimeBetData]
  );

  const potentialWinnings = useMemo(() => {
    if (ticketsTeamA > 0) return calculateGain(ticketsTeamA, "A");
    if (ticketsTeamB > 0) return calculateGain(ticketsTeamB, "B");
    if (tieTickets > 0) return calculateGain(tieTickets, "C");
    return 0;
  }, [ticketsTeamA, ticketsTeamB, tieTickets, calculateGain]);

  // Calculate odds with the specified formula
  const calculateOdds = useCallback(
    (team: "A" | "B" | "C") => {
      const { betsTeamA, betsTeamB, tieBets } = realtimeBetData;
      const totalBets = betsTeamA + betsTeamB + tieBets;

      if (totalBets === 0) return "+100"; // neutral

      let teamBets = 0;
      switch (team) {
        case "A":
          teamBets = betsTeamA;
          break;
        case "B":
          teamBets = betsTeamB;
          break;
        case "C":
          teamBets = tieBets;
          break;
      }

      if (teamBets === 0) return "+999"; // sin apuestas en ese lado

      // Probabilidad "real"
      const probability = teamBets / totalBets;

      // -------- Aplicar margen (vig) --------
      // Aquí asumimos overround = 105% (5% margen)
      const overround = 1.05;
      const adjustedProb = probability * overround;

      // Cuota decimal
      const decimalOdds = 1 / adjustedProb;

      // -------- Convertir a American odds --------
      let americanOdds;
      if (decimalOdds >= 2.0) {
        americanOdds = `+${Math.round((decimalOdds - 1) * 100)}`;
      } else {
        americanOdds = `-${Math.round(100 / (decimalOdds - 1))}`;
      }

      return americanOdds;
    },
    [realtimeBetData]
  );

  // Calculate winnings based on American odds
  const calculateAmericanOddsWinnings = useCallback(
    (team: "A" | "B" | "C", betAmount: any) => {
      if (betAmount === 0) return 0;

      const odds = calculateOdds(team);
      const numericOdds = parseInt(odds.replace(/[+\-]/g, ""));

      let winnings = 0;
      if (odds.startsWith("-")) {
        // Negative odds: bet amount needed to win $100
        winnings = (100 / numericOdds) * betAmount;
      } else {
        // Positive odds: amount won for every $100 bet
        winnings = (numericOdds / 100) * betAmount;
      }
      console.log(
        `Calculating winnings for team ${team} with odds ${odds} and bet amount ${betAmount}: ${winnings}`
      );
      console.log(
        "Total payout (winnings + original bet):",
        winnings + betAmount
      );
      return winnings + betAmount; // Return total payout (winnings + original bet)
    },
    [calculateOdds]
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
    if (totalTickets === 0) return;

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
    router,
  ]);

  // Team card component for better organization
  const TeamCard = ({
    teamKey,
    teamName,
    color,
    emoji,
    tickets,
    betsCount,
    disabled,
  }: {
    teamKey: "A" | "B" | "C";
    teamName: string;
    color: string;
    emoji: string;
    tickets: number;
    betsCount: string;
    disabled: boolean;
  }) => {
    const winPerTicket = calculateAmericanOddsWinnings(
      teamKey,
      realtimeBetData.pricePerTicket
    );

    return (
      <div
        className={`flex w-full sm:w-1/2 flex-col items-center justify-between rounded-xl text-white shadow cursor-pointer transition p-4 ${color}
        ${
          disabled
            ? "bg-gray-500 hover:bg-gray-500 opacity-50 pointer-events-none"
            : ""
        }`}
        onClick={() => updateTickets(teamKey, 1)}
      >
        {teamKey !== "C" && (
          <p className=''>
            {favorite === "Equals"
              ? `Empate: ${betsCount}`
              : `${
                  teamName === favorite ? "Favorito: " : "Menos favorito: "
                } ${betsCount}`}
          </p>
        )}

        {teamKey === "C" && <p className=''>Empate: {betsCount}</p>}

        <button className='w-full py-4 text-xl font-bold cursor-pointer'>
          {emoji} {teamName}
        </button>

        {/* Ticket Selector */}
        <div className='flex items-center gap-2 mt-4 mb-1'>
          <button
            className={`bg-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-gray-200 ${
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

        <div className='mt-2 bg-yellow-300 text-green-900 rounded px-3 py-1 text-sm font-semibold text-center'>
          Gana:
          <span className='cursor-pointer'>
            {winPerTicket.split(".")[0]}
          </span>{" "}
          Por boleto
        </div>
      </div>
    );
  };

  return (
    <div className='flex min-h-screen flex-col items-center bg-gray-100 p-4 text-gray-800'>
      {loading ? (
        <div className='flex justify-center items-center h-96'>
          <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600'></div>
        </div>
      ) : (
        <>
          {/* Main Image */}
          <img
            className='mb-6 h-[33vh] w-full rounded-xl bg-cover bg-center shadow-lg'
            src={realtimeBetData.image}
            alt={realtimeBetData.title}
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
            Apuesta por tu equipo favorito y gana más
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
              betsCount={calculateOdds("A")}
              disabled={ticketsTeamB > 0 || tieTickets > 0}
            />

            {/* Tie */}
            <TeamCard
              teamKey='C'
              teamName='Empate'
              color='bg-gray-600 hover:bg-gray-700'
              emoji=''
              tickets={tieTickets}
              betsCount={calculateOdds("C")}
              disabled={ticketsTeamA > 0 || ticketsTeamB > 0}
            />

            {/* Team B */}
            <TeamCard
              teamKey='B'
              teamName={realtimeBetData.teams.b}
              color='bg-red-600 hover:bg-red-700'
              emoji='🔴'
              tickets={ticketsTeamB}
              betsCount={calculateOdds("B")}
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
                <span className='text-white font-semibold text-md text-start'>
                  🏆 Gana hasta:{" "}
                  <span id='cartWinnings' className='ml-8 sm:ml-0'>
                    $
                    {calculateAmericanOddsWinnings(
                      selectedLetterTeam as "A" | "B" | "C",
                      totalPrice
                    ).toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
            <div className='flex justify-start'>
              <button
                className='bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-4 mt-2 sm:mt-0 py-2 rounded-lg shadow transition text-md sm:text-lg disabled:opacity-55
                disabled:hover:bg-yellow-400 disabled:cursor-not-allowed'
                disabled={totalTickets === 0}
                onClick={addToCart}
              >
                Agregar al carrito
              </button>
            </div>
          </div>
          <div className='h-36 sm:h-16'></div>
        </>
      )}
    </div>
  );
};

export default BetPageClient;
