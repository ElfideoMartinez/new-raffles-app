// app/raffle/[id]/RafflePageClient.tsx

"use client";

import React from "react";
import TicketButton from "@/app/components/TicketButton";
import AddToCartButton from "@/app/components/AddToCartButton";
import useTicketStore from "@/app/store";

interface IRaffleData {
  data: { number: number; sold: boolean; id: string }[];
  price: string;
  raffleImage: string;
}

const RafflePageClient = ({
  raffleData,
  raffleId,
}: {
  raffleData: IRaffleData;
  raffleId: string;
}) => {
  return (
    <div className='container mx-auto w-4/5 p-4'>
      <div className='bg-white shadow-lg rounded-lg overflow-hidden'>
        <img
          src={raffleData.raffleImage}
          alt='Raffle Image'
          className='w-full h-64 object-fill'
        />
        <div className='p-4 text-center grid-cols-6'>
          {raffleData.data.map((ticket, index) => (
            <TicketButton
              raffleId={raffleId}
              ticketNumber={ticket.number}
              key={`${ticket.id}#${index}`}
              isUnavailable={ticket.sold}
            />
          ))}
        </div>
      </div>
      <AddToCartButton
        raffleId={raffleId}
        rafflePrice={parseInt(raffleData.price)}
      />
    </div>
  );
};

export default RafflePageClient;
