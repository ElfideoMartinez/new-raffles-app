import React, { useEffect, useState } from "react";
import Link from "next/link";
import useTicketStore from "../store";

const CartButton = () => {

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  },[])

  const userCartBets = useTicketStore((state) => state.getBetsFromCart());
  const selectedTicketCount = useTicketStore((state) =>
    state.getItemsFromCart()
  );
  console.log("selectedTicketCount", selectedTicketCount);
  //got through the cart elements and sum all the ticket numbers
  const totalTickets = selectedTicketCount.reduce(
    (acc, item) => acc + item.ticketNumbers.length,
    0
  );
  const totalTicketsBets = userCartBets.reduce(
    (acc, bet) => acc + (bet.ticketNumbers || 0), 0
  )
  console.log("totalTickets", totalTickets+totalTicketsBets);
  
  if (!isHydrated){
    return (
      <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 576 512'
      className='h-7 w-7 fill-white	'
      >
        <path d='M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 336c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z' />
      </svg>
    )
  }

  return (
    <Link href='/user/cart' className='inline-flex items-center gap-1 shrink-0 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'>
      <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold leading-none text-white'>
        {totalTickets+totalTicketsBets}
      </span>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 576 512'
        aria-hidden="true"
        className='h-7 w-7 shrink-0 fill-white'
      >
        <path d='M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 336c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z' />
      </svg>
    </Link>
  );
};

export default CartButton;
