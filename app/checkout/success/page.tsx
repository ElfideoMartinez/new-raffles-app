"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

// Route the buyer came from before checkout (set by the cart page).
// Falls back to the list view.
const HOME_FALLBACK = "/";
const readCheckoutOrigin = () => {
  try {
    const origin = sessionStorage.getItem("checkoutOrigin");
    return origin && origin.startsWith("/") ? origin : HOME_FALLBACK;
  } catch {
    return HOME_FALLBACK;
  }
};
import useTicketStore from "@/app/store";
import { useCheckoutSuccessConfig } from "@/app/config/checkoutSuccessConfig";
import { useStorefrontConfig } from "@/app/config/storefrontConfig";

interface IRaffle {
  raffleId: string;
  raffleName: string;
  ticketNumbers: number[];
  raffleTotalPrice: number;
};

interface IBet {
  betId: string;
  betName: string;
  team: string;
  letterTeam: string;
  ticketNumbers: number;
  totalPrice: number;
};

const SuccessPage = () => {
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  const bets = useTicketStore((state) => state.getBetsFromCart());
  const cleanCart = useTicketStore((state) => state.cleanCart);
  const cleanBets = useTicketStore((state) => state.clearCartBets);
  const cleanSelected = useTicketStore((state) => state.clearSelectedTickets);
  // Copy is runtime-editable from /admin/config; falls back to the original
  // hardcoded strings if the Firestore doc is absent.
  const copy = useCheckoutSuccessConfig();
  // Contact lines come from the shared storefront config so /contact,
  // /checkout/success and the transfer page can never disagree.
  const contact = useStorefrontConfig();

  const [isHydrated, setIsHydrated] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [returnRoute, setReturnRoute] = useState(HOME_FALLBACK);
  const returnRouteRef = useRef<string | null>(null);

  useEffect(() => {
    // Ticket state is owned by the server: transfer sales are confirmed by an
    // admin. The client must not mark tickets sold.
    const count = raffles.map((raffle) => raffle.ticketNumbers.sort((a, b) => a - b)).flat().length;
    setTicketCount(count);
    saveSaleLocalStorage();

    cleanCart();
    cleanBets();
    cleanSelected();
    setIsHydrated(true);
    // Read the return route once, before removing the key. React's dev-mode
    // StrictMode unmount/remount re-runs this effect, and a second read after
    // removeItem would see null and fall back to HOME_FALLBACK. Keep the
    // captured value in a ref so the re-run can't lose it.
    if (returnRouteRef.current === null) {
      returnRouteRef.current = readCheckoutOrigin();
    }
    setReturnRoute(returnRouteRef.current || HOME_FALLBACK);
    try { sessionStorage.removeItem("checkoutOrigin"); } catch { /* private mode */ }
  }, []);

  const saveSaleLocalStorage = () => {
    const saved = localStorage.getItem("purchases");
    let purchases: { date: string, raffles: IRaffle[], bets: IBet[] }[] = [];

    if (saved) {
      try {
        purchases = JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing localStorage purchases");
      }
    }

    const newPurchase = {
      date: new Date().toISOString(), // puedes usar otra forma si lo prefieres
      raffles: raffles,
      bets: bets,
    };

    purchases.push(newPurchase);
    localStorage.setItem("purchases", JSON.stringify(purchases));
  }


  if(!isHydrated){
    return(
      <div></div>
    )
  }

  return (
    <div className='flex flex-col w-full items-center mt-7 px-7 text-center gap-3'>
      <p>
        <strong>{copy.thanksTitle}</strong>
        <br/><br/>
        {copy.winnerWhere}
      </p>
      <p>
        {copy.winnerHow}
      </p>
      <div>
        <p className='whitespace-pre-line'>
          {ticketCount > 5 ? copy.manyTicketsNote : copy.fewTicketsNote}
        </p>
      </div>
      <p>{contact.contactIntro}</p>
      <p>
        {contact.contactEmail ? <>📧 Correo: {contact.contactEmail}<br/></> : null}
        {contact.contactPhones.map((phone) => (
          <span key={phone}>📞 Teléfono: {phone}<br/></span>
        ))}
      </p>
      <Link href={returnRoute} className='p-2 mt-4 rounded-card' style={{ backgroundColor: "var(--color-brand-700)" }}>
        {copy.homeButtonLabel}
      </Link>
    </div>
  );
};

export default SuccessPage;