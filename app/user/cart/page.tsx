"use client";
import React, { useEffect } from "react";
import useTicketStore from "@/app/store";
import Link from "next/link";

const UserCartPage = () => {
  const tickets = useTicketStore((state) => state.getItemsFromCart());
  console.log("Tickets", tickets);
  const totalRafflePrice = tickets.reduce(
    (total, raffle) => total + (raffle.raffleTotalPrice || 0),
    0
  );

  console.log("Total Raffle Price:", totalRafflePrice);

  // Group tickets by raffleId
  const groupedTickets = tickets.reduce((acc: any, ticket: any) => {
    const { raffleId, ticketNumbers } = ticket;
    if (!acc[raffleId]) {
      acc[raffleId] = { raffleId, ticketNumbers: [] };
    }
    acc[raffleId].ticketNumbers =
      acc[raffleId].ticketNumbers.concat(ticketNumbers);
    return acc;
  }, {});

  // Convert the grouped tickets object back to an array
  const groupedTicketsArray = Object.values(groupedTickets);
  console.log("Grouped Tickets", groupedTicketsArray);

  return (
    <div>
      <header className="flex justify-center mt-2">
        <h1>Carrito</h1>
      </header>
      <ul className='flex w-screen overflow-hidden flex-col'>
        {tickets.map((ticket: any) => (
          <li key={ticket.raffleId}>
            <div className="ml-2">
              <h2>Raffle ID: {ticket.raffleId}</h2>
              <p className="pb-1">Precio de boleto: ${ticket.raffleTotalPrice}</p>
            </div>
            <ul>
              <li className='flex w-full justify-between'>
                <ul className='flex flex-wrap gap-2'>
                  {ticket.ticketNumbers.map((number: number, index: number) => (
                    <li key={index} className='p-2 rounded-lg bg-green-500 ml-2 mb-2 flex justify-center'>
                      {number}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    useTicketStore
                      .getState()
                      .removeItemFromCart(ticket.raffleId);
                  }}
                  className='bg-red-500 p-2 h-12 w-12 fill-white rounded-lg flex items-center justify-center mr-2'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'>
                    <path d='M170.5 51.6L151.5 80l145 0-19-28.4c-1.5-2.2-4-3.6-6.7-3.6l-93.7 0c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80 368 80l48 0 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-8 0 0 304c0 44.2-35.8 80-80 80l-224 0c-44.2 0-80-35.8-80-80l0-304-8 0c-13.3 0-24-10.7-24-24S10.7 80 24 80l8 0 48 0 13.8 0 36.7-55.1C140.9 9.4 158.4 0 177.1 0l93.7 0c18.7 0 36.2 9.4 46.6 24.9zM80 128l0 304c0 17.7 14.3 32 32 32l224 0c17.7 0 32-14.3 32-32l0-304L80 128zm80 64l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16z' />
                  </svg>
                </button>
              </li>
            </ul>
          </li>
        ))}
        <p className='self-center'>Monto total: ${totalRafflePrice}</p>
      </ul>
      {groupedTicketsArray.length > 0 ? (
        <div className='flex justify-between mx-2 mt-1'>
          <Link
            locale='fr'
            // href={{
            //   pathname: "/checkout/card",
            //   query: { cartTotal: totalRafflePrice },
            // }}
            href="/checkout/card"
            className='bg-blue-500 text-center text-white p-2 rounded-lg w-1/2'
          >
            Pago con tarjeta
          </Link>
          <Link
            href='/checkout/transfer'
            className='bg-yellow-500 text-white p-2 rounded-lg w-1/2 flex justify-center'
          >
            Pago por transferencia
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default UserCartPage;
