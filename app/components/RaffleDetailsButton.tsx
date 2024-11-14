"use client";
import React, { useEffect } from "react";
import Link from "next/link";
///import next navigation
interface IRaffeDetailsButtonProps {
  id: string;
  price: number;
}
//this will recieve the id of the raffle and will redirect to the raffle details page
const RaffleDetailsButton = ({ id, price }: IRaffeDetailsButtonProps) => {
  //a button to go to the raffle/:id page with the id of the raffle and send it as parameter
  return (
    <Link
      href={`/raffle/${id}`}
      className='bg-blue-500 text-white block text-center p-2'
    >
      View Raffle
    </Link>
  );
};

export default RaffleDetailsButton;
