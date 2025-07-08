'use client'
import OfferStar from "@/app/components/OfferStar";
import useTicketStore from "@/app/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface IBetDataResponse {
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  betImage: string;
  betTitle: string;
  date: string;
  betDescription: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  teams: Array<string>;
  isFinished: boolean;
}

const BetPageClient = ({betData, betId}:{betData: IBetDataResponse, betId: string}) => {

  const router = useRouter();
  const { updateBet } = useTicketStore();
  const userCartBets = useTicketStore((state) => state.getBetsFromCart);
  const userTicketsBets = useTicketStore((state) => state.getTicketInfoByBetId);

  const [favorite, setFavorite] = useState('');
  const [team, setTeam] = useState('');
  const [letterTeam, setLetterTeam] = useState('');
  const [ticketsTeamA, setTicketsTeamA] = useState(0);
  const [ticketsTeamB, setTicketsTeamB] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [toWin, setToWin] = useState(0);

  useEffect(() => {
    
    const infoCartBets = userTicketsBets(betId);
    if(infoCartBets){
      infoCartBets?.letterTeam == 'A' ? setTicketsTeamA(infoCartBets.ticketNumbers): setTicketsTeamB(infoCartBets.ticketNumbers);
      calculateGain(infoCartBets.ticketNumbers, infoCartBets.letterTeam);
    }
    
    if(betData.betsTeamA == betData.betsTeamB){
      setFavorite('Equals');
      return;
    }
    const favorite = betData.betsTeamA > betData.betsTeamB ? betData.teams[0]: betData.teams[1];
    setFavorite(favorite);
  },[])

  const updateTickets = (team: string, action: number) => {
    if(team=='A'){
      const newCount = ticketsTeamA + action;
      setTicketsTeamA(newCount);
      setTeam(betData.teams[0])
      calculateGain(newCount, 'A');
    }else{
      const newCount = ticketsTeamB + action;
      setTicketsTeamB(newCount);
      setTeam(betData.teams[1])
      calculateGain(newCount, 'B');
    }
  }

  const calculateGain = (numberOfTickets: number, team: string) => {
    let toWin;
    let poolTotal;
  
    poolTotal = (betData.initialPool);

    if(betData.betsTeamA == 0 && team === 'A'){
      toWin=poolTotal*numberOfTickets;
    }else if(betData.betsTeamB == 0 && team === 'B'){
      toWin=poolTotal*numberOfTickets;
    }else{
      const winPerTicket = team == 'A' ? poolTotal/betData.betsTeamA : poolTotal/betData.betsTeamB;
      toWin = (winPerTicket*numberOfTickets);
    }
    
    setToWin(toWin);
    setTotalTickets(numberOfTickets);
    const letter = team;
    setLetterTeam(letter);
  }

  const addToCart = () => {
    updateBet({
      betId: betId,
      betName: betData.betTitle,
      team: team,
      letterTeam: letterTeam,
      ticketNumbers: totalTickets,
      totalPrice: parseInt(betData.pricePerTicket)*totalTickets,
    })
    console.log(userCartBets());
  }

  return (
    <div className='flex min-h-screen flex-col items-center bg-gray-100 p-4 text-gray-800'>
      {/* Imagen principal */}
      <img
        className="mb-6 h-[33vh] w-full rounded-xl bg-cover bg-center shadow-lg"
        src={betData.betImage}
      ></img>

      {/* Título y descripción */}
      <h1 className="mb-2 text-xl font-bold text-center">🏆 ¡Haz tu apuesta ahora!</h1>
      <h1 className="mb-2 text-3xl font-bold text-center">{betData.betTitle}</h1>
      <h2 className="mb-3 text-xl font-bold text-center">{betData.betDescription}</h2>
      <p className="mb-4 text-center text-sm text-gray-600">
        Apuesta por tu equipo favorito y gana más
      </p>
      <div className="mb-2">
        <OfferStar text={betData.pricePerTicket}/>
      </div>
      <div className="flex text-center mb-2 font-semibold gap-7">
        <p>Pool actual: ${betData.initialPool}</p>
      </div>

      {/* Contenedores de los equipos */}
      <div className={`flex w-full sm:max-w-2xl items-center flex-col md:flex-row justify-center gap-6 ${betData.isFinished ? 'pointer-events-none opacity-40': '' }`}>
        {/* Equipo A */}
        <div 
          className={`flex w-full sm:w-1/2 flex-col items-center justify-between rounded-xl bg-green-600 text-white shadow cursor-pointer transition hover:bg-green-700 p-4
          ${ticketsTeamB > 0 ? 'bg-gray-500 hover:bg-gray-500 opacity-50 pointer-events-none' : ''}`}
          onClick={() => updateTickets('A', 1)}
        > 
          {favorite == 'Equals' ? <p>Empatados: {betData.betsTeamA}</p> : 
            <p className="">{betData.teams[0] == favorite ? 'Favorito: ' : 'Menos favorito: '} {betData.betsTeamA}</p>
          }         
          <button className="w-full py-4 text-xl font-bold cursor-pointer">⚪ {betData.teams[0]}</button>
          {/* Ticket Selector */}
          <div className="flex items-center gap-2 mt-4 mb-1">
            <button
              className={`bg-white text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-gray-200
              `}
              disabled={ticketsTeamA == 0}
              onClick={(e) => {
                updateTickets('A', -1)
                e.stopPropagation();
              }}
            >
              −
            </button>
            <span id="ticketsA" className="text-lg font-semibold">{ticketsTeamA}</span>
          </div>
          <div className="mt-2 bg-yellow-300 text-green-900 rounded px-3 py-1 text-sm font-semibold text-center">
            Puedes ganar hasta: $
            <span id="winningsA" className="cursor-pointer">
              {betData.betsTeamA == 0 ? `${betData.initialPool} `: `${((betData.initialPool)/betData.betsTeamA).toFixed(2)} `}
            </span> 
            x boleto
          </div>
        </div>
        {/* Equipo B */}
        <div 
          className={`flex w-full sm:w-1/2 flex-col items-center justify-between rounded-xl bg-red-600 text-white shadow transition cursor-pointer hover:bg-red-700 p-4
          ${ticketsTeamA > 0 ? 'bg-gray-500 hover:bg-gray-500 opacity-50 pointer-events-none' : ''}`}
          onClick={() => updateTickets('B', 1)}
        > 
          {favorite == 'Equals' ? <p>Empatados: {betData.betsTeamB}</p> : 
            <p className="">{betData.teams[1] == favorite ? 'Favorito: ' : 'Menos favorito: '} {betData.betsTeamB}</p>
          }
          <button className="w-full py-4 text-xl font-bold cursor-pointer">🔴 {betData.teams[1]}</button>
          {/* Ticket Selector */}
          <div className="flex items-center gap-2 mt-4 mb-1">
            <button
              className="bg-white text-red-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg hover:bg-gray-200"
              disabled={ticketsTeamB == 0}
              onClick={(e) => {
                updateTickets('B', -1)
                e.stopPropagation(); // prevent upward event propagation
              }}
            >
              −
            </button>
            <span id="ticketsB" className="text-lg font-semibold">{ticketsTeamB}</span>
          </div>
          <div className="mt-2 bg-yellow-300 text-green-900 rounded px-3 py-1 text-sm font-semibold text-center">
            Puedes ganar hasta: $
            <span id="winningsA" className="cursor-pointer">
              {betData.betsTeamB == 0 ? `${betData.initialPool}  `: `${((betData.initialPool)/betData.betsTeamB).toFixed(2)} ` }
            </span> 
             x boleto
          </div>
        </div>
      </div>

      {/* Call to action */}
      <p className="mt-4 mb-3 text-center text-sm text-gray-500">
        ⚠️ Las ganancias pueden cambiar según nuevas apuestas antes del cierre
      </p>

      <div className="w-full bg-blue-600 shadow-lg flex sm:flex-row justify-between sm:items-center px-4 py-4 fixed bottom-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="text-white font-bold text-lg">Total: ${parseInt(betData.pricePerTicket)*totalTickets}</span>
          <span className="text-white font-semibold">
            🎟️ <span id="cartTickets">{ticketsTeamA || ticketsTeamB}</span> boletos
          </span>
          <div>
            <span className="text-white font-semibold text-md text-start">
              🏆 Gana hasta: <span id="cartWinnings" className="ml-8 sm:ml-0"> {ticketsTeamA == 0 && ticketsTeamB == 0 ? '$0' : `$${toWin.toFixed(2)}`}</span>
            </span>
          </div>
        </div>
        <div className="flex justify-start">
          <button
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-4 mt-2 sm:mt-0 py-2 rounded-lg shadow transition text-md sm:text-lg disabled:opacity-55
            disabled:hover:bg-yellow-400 disabled:cursor-not-allowed"
            disabled={ticketsTeamA == 0 && ticketsTeamB == 0}
            onClick={() => {
              addToCart()
              router.push("/user/cart", {
                scroll: false,
              });
            }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
      <div className="h-36 sm:h-16"></div>
    </div>
  );
};

export default BetPageClient;

