"use client";
import Link from "next/link";
import React, { useEffect } from "react";
import useTicketStore from "@/app/store";
const SuccessPage = () => {
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  const cleanCart = useTicketStore((state) => state.cleanCart);
  const cleanSelected = useTicketStore((state) => state.clearSelectedTickets);

  console.log("Tickets", raffles);
  useEffect(() => {
    markAsSold();
    cleanCart();
    console.log("cleaning cart from outside");
    cleanSelected();
  }, []);
  const markAsSold = async () => {
    const promises = raffles.map((raffle) =>
      fetch(`https://us-central1-raffleapp-dbc1b.cloudfunctions.net/success`, {
        cache: "default",
        method: "POST",
        body: JSON.stringify({
          raffleId: raffle.raffleId,
          ticketNumbers: raffle.ticketNumbers,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
    await Promise.all(promises);
  };

  return (
    <div className='flex flex-col w-full items-center'>
      <h1>Success</h1>
      <div>Gracias por su compra!</div>
      <Link href='../' className='p-2 bg-blue-500 border-white border-2 mt-4'>
        Ir a inicio
      </Link>
    </div>
  );
};

export default SuccessPage;
