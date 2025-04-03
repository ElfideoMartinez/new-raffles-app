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
  //console.log(SelectedTickets);

  const [isHydrated, setIsHydrated] = useState(false);

  const verifyInTheCart = (ticketNumber: IticketNumber) => selectedTickets.includes(ticketNumber as any);

  useEffect(() => {
    clearSelectedTickets();
    setIsHydrated(true);
  },[])

  if (!isHydrated) return <div className="flex justify-center items-center mt-5"><FadeLoader color='#ffffff'/></div>

  const thereIsWinner = raffleData.ticketWinner != '';
  console.log(thereIsWinner);
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
        </div>)}
        <div className={`p-4 text-center grid-cols-6 ${thereIsWinner ? 'cursor-not-allowed opacity-80 pointer-events-none' : ''}`}>
        {raffleData.data.map((ticket, index) => (      
            <TicketButton
              raffleId={raffleId}
              ticketNumber={ticket.number}
              key={`${ticket.id}#${index}`}
              isUnavailable={ticket.sold}
              inTheCart={verifyInTheCart(ticket.number as any)}
            />
          ))}
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
