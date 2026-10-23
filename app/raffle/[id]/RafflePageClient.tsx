// app/raffle/[id]/RafflePageClient.tsx

"use client";

import React, {useEffect, useState} from "react";
import TicketButton from "@/app/components/TicketButton";
import AddToCartButton from "@/app/components/AddToCartButton";
import useTicketStore from "@/app/store";
import { FadeLoader } from "react-spinners";
import { toast } from "nextjs-toast-notify";
import { formatPrice } from "@/app/utils/format";

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
  awardDescription: string;
  awardName: string;
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

  if (!isHydrated) return <div className="flex justify-center items-center mt-5"><FadeLoader color="var(--color-brand-700)"/></div>

  const thereIsWinner = raffleData.ticketWinner != '' && raffleData.ticketWinner != '.';
  
  const handleRandomTicket = () => {
    const availableTickets = raffleData.data.filter(ticket => !ticket.sold);

    if (availableTickets.length === 0) {
      toast.warning('Ya no hay boletos disponibles',{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      })
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
      toast.success(`¡Listo! Tu número es ${ticketRandom}, mucha suerte 🍀😉`,{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
      //addTicketsToCart(raffleId, parseInt(raffleData.price), raffleData.raffleName);
    } else {
      toast.warning('No hay mas boletos por escoger',{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
    }
  }

  return (
    
    <div className='container mx-auto flex w-11/12 p-4 relative justify-center'>
      <div className="absolute left-0 top-10 z-10" >
        <button
          disabled={thereIsWinner} 
          className={`${thereIsWinner ? 'opacity-80 cursor-not-allowed' : ''} random-ticket-button`}
          onClick={() => handleRandomTicket()}>
          🎯 ¡Dame un número!
        </button>
      </div>
      <div className='bg-white shadow-lg rounded-md overflow-hidden w-10/12'>
        {/* Raw <img>: the URL comes from Firestore and next/image would need a
            remotePatterns entry per storage host. object-cover fixes the
            distortion caused by object-fill. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- see comment above */}
        <img
          src={raffleData.raffleImage}
          alt={raffleData.awardName || raffleData.raffleName}
          className='w-full h-64 object-cover'
        />
        <div className="text-black font-bold text-lg md:text-xl text-center pt-3 px-3 md:px-2">
          <p>Premio: {raffleData.awardName}</p>
          <p>Descripción del premio: {raffleData.awardDescription}</p>
        </div>
        {thereIsWinner && (
        <div className="flex flex-col items-center text-center mt-4 p-4 bg-gray-100 rounded-card shadow-md">
          <p className="text-black text-2xl font-semibold">🎉 Boleto Ganador 🎉</p>
          <div className="flex justify-center items-center rounded-pill bg-green-600 text-white font-bold text-3xl h-20 w-20 mt-3 shadow-lg">
            {raffleData.ticketWinner}
          </div>
          <p className="text-black text-xl mt-2">Gracias por tu participación, Rifas Mtz se pondrá en contacto con el ganador</p>
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
        <AddToCartButton
          raffleId={raffleId}
          raffleName={raffleData.raffleName}
          rafflePrice={parseInt(raffleData.price)}
        />
      </div>
    </div>
  );
};

export default RafflePageClient;
