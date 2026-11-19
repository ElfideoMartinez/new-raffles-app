"use client";
import React, { useEffect, useState } from "react";
import useTicketStore from "@/app/store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatPrice } from "@/app/utils/format";
import { showToast } from "nextjs-toast-notify";

const UserCartPage = () => {
  // Remember where the buyer came from so /checkout/success can send them back
  // here instead of hardcoding a parent route (backlog item 9).
  const pathname = usePathname();
  const tickets = useTicketStore((state) => state.getItemsFromCart());
  const userCartBets = useTicketStore((state) => state.getBetsFromCart());
  const removeBet = useTicketStore((state) => state.removeBetById);
  const totalRafflePrice = tickets.reduce(
    (total, raffle) => total + (raffle.raffleTotalPrice || 0),
    0
  );
  const totalBetsPrice = userCartBets.reduce(
    (total, bet) => total + (bet.totalPrice || 0), 0
  )

  const [isHydrated, setIsHydrated] = useState(false);


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

  useEffect(() => {
    setIsHydrated(true);
    if(totalRafflePrice!=0) {
      showToast.info('Para eliminar boletos individualmente has click o tap',{
        duration: 2000,
        progress: true,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
    }
  },[]);

  if (!isHydrated) return (
    <div>
      <header className="flex justify-center mt-2">
        <h1>Carrito</h1>
      </header>
    </div>
  )

  return (
    <div>
      <header className="flex justify-center mt-2">
        <h1>Carrito</h1>
      </header>
      <ul className='flex w-full overflow-hidden flex-col'>
        {tickets.map((ticket: any) => (
          <li key={ticket.raffleId}>
            <div className="ml-2">
              <h2>Rifa: {ticket.raffleName}</h2>
              <p className="">Precio de boleto: {formatPrice(ticket.raffleTotalPrice/ticket.ticketNumbers.length)}</p>
              <p className="pb-1">Precio total: {formatPrice(ticket.raffleTotalPrice)}</p>
            </div>
            <ul>
              <li className='flex w-full justify-between'>
                <ul className='flex flex-wrap gap-2'>
                  {ticket.ticketNumbers.map((number: number) => (
                    <li key={number} className='ml-2 mb-2'>
                      <button type="button"
                        className='p-2 rounded-card bg-success-500 flex justify-center hover:cursor-pointer hover:bg-danger-500'
                        onClick={() => {
                        useTicketStore.getState().removeTicketFromCart(ticket.raffleId, number);
                        showToast.success('Boleto borrado',{
                          duration: 800,
                          transition: 'popUp',
                          progress: false,
                          sound: false,
                          position: 'top-right',
                        })
                        }}
                      >
                        {number}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    useTicketStore
                      .getState()
                      .removeItemFromCart(ticket.raffleId);
                  }}
                  className='bg-danger-700 p-2 h-12 w-12 rounded-card flex items-center justify-center mr-2'
                  aria-label="Borrar todos los boletos"
                >{/* eslint-disable-next-line @next/next/no-img-element -- 24px static icon, next/image adds a request hop for no gain */}
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' className='w-6 h-6 text-white' fill='currentColor' aria-hidden='true'>
                    <path d='M170.5 51.6L151.5 80l145 0-19-28.4c-1.5-2.2-4-3.6-6.7-3.6l-93.7 0c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80 368 80l48 0 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-8 0 0 304c0 44.2-35.8 80-80 80l-224 0c-44.2 0-80-35.8-80-80l0-304-8 0c-13.3 0-24-10.7-24-24S10.7 80 24 80l8 0 48 0 13.8 0 36.7-55.1C140.9 9.4 158.4 0 177.1 0l93.7 0c18.7 0 36.2 9.4 46.6 24.9zM80 128l0 304c0 17.7 14.3 32 32 32l224 0c17.7 0 32-14.3 32-32l0-304L80 128zm80 64l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16z' />
                  </svg>
                </button>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex w-full flex-col gap-2 px-2 py-2">
        {userCartBets.map((bet) => (
          <div key={bet.betId} className="flex items-center justify-between gap-3 rounded-card border border-ink-100 bg-surface p-3">
            <div className="flex min-w-0 items-center gap-3">
              {bet.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- persisted bets may use arbitrary remote image hosts
                <img src={bet.image} alt={`Imagen de ${bet.betName}`} className="h-20 w-20 shrink-0 rounded-sm object-cover" />
              ) : (
                <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-ink-100 text-ink-500">Sin imagen</div>
              )}
              <div className="min-w-0">
                <p className="font-semibold">Apuesta: {bet.betName}</p>
                <p>Equipo: {bet.team}</p>
                <p>Boletos: {bet.ticketNumbers}</p>
                <p>Precio de boleto: {formatPrice(bet.totalPrice/bet.ticketNumbers)}</p>
                <p>Precio total: {formatPrice(bet.totalPrice)}</p>
              </div>
            </div>
            <button
              onClick={() => removeBet(bet.betId)}
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-danger-700'
              aria-label="Borrar apuesta"
            >
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' className='h-6 w-6 text-white' fill='currentColor' aria-hidden='true'>
                  <path d='M170.5 51.6L151.5 80l145 0-19-28.4c-1.5-2.2-4-3.6-6.7-3.6l-93.7 0c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80 368 80l48 0 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-8 0 0 304c0 44.2-35.8 80-80 80l-224 0c-44.2 0-80-35.8-80-80l0-304-8 0c-13.3 0-24-10.7-24-24S10.7 80 24 80l8 0 48 0 13.8 0 36.7-55.1C140.9 9.4 158.4 0 177.1 0l93.7 0c18.7 0 36.2 9.4 46.6 24.9zM80 128l0 304c0 17.7 14.3 32 32 32l224 0c17.7 0 32-14.3 32-32l0-304L80 128zm80 64l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16z' />
                </svg>
              </button>
          </div>
        ))}
      </div>
      {groupedTicketsArray.length > 0 || userCartBets.length > 0 ? (
        <div className='mx-2 mt-2'>
          <p className='self-center text-center mb-2'>Monto total: {formatPrice(totalRafflePrice + totalBetsPrice)}</p>
          <Link
            href='/checkout/transfer'
            onClick={() => {
              try { sessionStorage.setItem("checkoutOrigin", pathname); } catch { /* private mode */ }
            }}
            className='bg-brand-600 text-on-brand p-2 rounded-card w-full flex justify-center'
          >
            Pago por transferencia
          </Link>
        </div>
      ) : (
        <div className="mx-2 mt-6 rounded-card border border-ink-100 bg-surface p-10 text-center shadow-card">
          <p className="text-lg font-semibold text-ink-900">Tu carrito está vacío</p>
          <p className="mt-1 text-sm text-ink-500">
            Elige boletos en una rifa activa para continuar.
          </p>
        </div>
      )}
    </div>
  );
};

export default UserCartPage;