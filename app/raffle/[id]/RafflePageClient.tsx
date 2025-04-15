// app/raffle/[id]/RafflePageClient.tsx

"use client";

import React, {useEffect, useState} from "react";
import TicketButton from "@/app/components/TicketButton";
import AddToCartButton from "@/app/components/AddToCartButton";
import useTicketStore from "@/app/store";
import { FadeLoader } from "react-spinners";

interface IticketNumber {
  number: number | string
}

interface ITikets {
  [key: string]: {
    ticketNumbers: number[];
  };
}

interface IRaffleData {
  data: { number: number; sold: boolean; id: string }[];
  price: string;
  raffleImage: string;
  raffleName: string;
  ticketWinner: string;
}

const RafflePageClient = ({
  raffleData,
  raffleId,
}: {
  raffleData: IRaffleData;
  raffleId: string;
}) => {

  const { getTicketsInCartByRaffleId, clearSelectedTickets } = useTicketStore();
  
  const selectedTickets = getTicketsInCartByRaffleId(raffleId);
  const tickets = useTicketStore((state) => state.tickets);

  const addTicket = useTicketStore((state) => state.addTicket);
  const addTicketsToCart = useTicketStore((state) => state.addTicketsToCart);
  //console.log(SelectedTickets);

  const [isHydrated, setIsHydrated] = useState(false);

  const verifyInTheCart = (ticketNumber: IticketNumber) => selectedTickets.includes(ticketNumber as any);
  const verifySelected = (ticketNumber: IticketNumber) => Object.values(tickets).some(({ ticketNumbers }) =>
  Array.isArray(ticketNumbers) && ticketNumbers.includes(ticketNumber as any));

  useEffect(() => {
    clearSelectedTickets();
    setIsHydrated(true);
  },[])

  useEffect(() => {
    console.log('tickets desde pagina de rifa',tickets)
  },[tickets])

  if (!isHydrated) return <div className="flex justify-center items-center mt-5"><FadeLoader color='#ffffff'/></div>

  const thereIsWinner = raffleData.ticketWinner != '' && raffleData.ticketWinner != '.';
  
  const handleRandomTicket = () => {
    const availableTickets = raffleData.data.filter(ticket => !ticket.sold);

    if (availableTickets.length === 0) {
      alert("Ya no hay boletos disponibles.");
      return;
    }
    
    const min = 0;
    const max = availableTickets.length - 1;
    
    let isInSelectedTicket;
    let ticketRandom: number | null = null; 
    let randomIndex = -1;
    
    let validTicketFound = false; 
    
    let attempts = 0; 
    const maxAttempts = availableTickets.length * 10;
    
    do {
      randomIndex = Math.floor(Math.random() * (max - min + 1)) + min;
    
      const ticketNumber = availableTickets[randomIndex]?.number;
    
      if (ticketNumber === undefined) {
        continue;
      }
    
      isInSelectedTicket = selectedTickets.includes(ticketNumber) ||
        Object.values(tickets).some(ticketData => Array.isArray(ticketData.ticketNumbers) && ticketData.ticketNumbers.includes(ticketNumber));
    
      if (!isInSelectedTicket) {
        validTicketFound = true;
        ticketRandom = availableTickets[randomIndex]?.number;
      }
    
      attempts++; 
    
    } while (!validTicketFound && attempts < maxAttempts); 
    
    if (validTicketFound && ticketRandom !== null) {
      addTicket(ticketRandom, raffleId);
      //addTicketsToCart(raffleId, parseInt(raffleData.price), raffleData.raffleName);
    } else {
      alert("No hay mas boletos por escoger");
    }
  }

  return (
    
    <div className='container mx-auto w-4/5 p-4'>
      <div className='bg-white shadow-lg rounded-lg overflow-hidden'>
        <img
          src={raffleData.raffleImage}
          alt='Raffle Image'
          className='w-full h-64 object-fill'
        />
        {thereIsWinner && (
        <div className="flex flex-col items-center text-center mt-4 p-4 bg-gray-100 rounded-xl shadow-md">
          <p className="text-black text-2xl font-semibold">🎉 Boleto Ganador 🎉</p>
          <div className="flex justify-center items-center rounded-xl bg-green-600 text-white font-bold text-3xl h-20 w-20 mt-3 shadow-lg">
            {raffleData.ticketWinner}
          </div>
          <p className="text-black text-xl mt-2">Gracias por su participacion, Rifas Mtz se pondra en contacto con el ganador</p>
        </div>)}
        <div className={`p-4 text-center grid-cols-6 ${thereIsWinner ? 'cursor-not-allowed opacity-80 pointer-events-none' : ''}`}>
        {raffleData.data.map((ticket, index) => (      
            <TicketButton
              raffleId={raffleId}
              ticketNumber={ticket.number}
              key={`${ticket.id}#${index}`}
              isUnavailable={ticket.sold}
              inTheCart={verifyInTheCart(ticket.number as any)}
              isSelectedPrev={verifySelected(ticket.number as any)}
            />
          ))}
        </div>
        <div className="flex justify-center mb-3" >
          <button
            disabled={thereIsWinner} 
            className={`bg-blue-500 px-6 py-2 rounded-lg font-bold ${thereIsWinner ? 'opacity-80 cursor-not-allowed' : ''}`}
            onClick={() => handleRandomTicket()}>
            Boleto al azar
          </button>
        </div>
      </div>
      <AddToCartButton
        raffleId={raffleId}
        raffleName={raffleData.raffleName}
        rafflePrice={parseInt(raffleData.price)}
      />
    </div>
  );
};

export default RafflePageClient;
