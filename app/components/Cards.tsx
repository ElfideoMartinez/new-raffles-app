import Image from "next/image";
import React from "react";
import RaffleDetailsButton from "./RaffleDetailsButton";

interface ICardsProps {
  id: string;
  name: string;
  total_tickets: number;
  tickets_left: number;
  pricePerTicket: number;
  date: string;
  awardImage: string;
}
const Cards = ({
  id,
  name,
  total_tickets,
  tickets_left,
  pricePerTicket,
  date,
  awardImage,
}: ICardsProps) => {
  return (
    <div className='bg-white shadow-lg rounded-lg overflow-hidden'>
      <img src={awardImage} alt='raffle' className='object-fill self-center' />
      <div className='p-4'>
        <h2 className='text-xl font-bold mb-2 text-slate-500'>
          {name || "Event"}
        </h2>
        <p className='text-gray-600'>
          Total Tickets: <span className='font-semibold'>{total_tickets}</span>
        </p>
        <p className='text-gray-600'>
          Tickets Available:{" "}
          <span className='font-semibold'>{tickets_left}</span>
        </p>
        <p className='text-gray-600'>
          Price: <span className='font-semibold'>${pricePerTicket}</span> per
          unit
        </p>
        <p className='text-gray-600'>End Date:{date} </p>
      </div>
      <RaffleDetailsButton id={id} price={pricePerTicket} />
    </div>
  );
};

export default Cards;
