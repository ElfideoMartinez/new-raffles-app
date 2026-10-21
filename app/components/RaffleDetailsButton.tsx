"use client";
import React from "react";
import Link from "next/link";

interface IRaffeDetailsButtonProps {
  id: string;
  price: number;
}

/**
 * CTA into a raffle's detail page.
 *
 * Reworked 2026-10-20: previously declared `bg-blue-500` then overrode it with
 * an inline `#355b6eff`, so the primary action on every storefront card
 * rendered as dark teal and ignored the brand tokens. Now uses the shared
 * brand-cta gradient and matches the ticket buttons elsewhere.
 */
const RaffleDetailsButton = ({ id }: IRaffeDetailsButtonProps) => {
  return (
    <Link
      href={`/raffle/${id}`}
      className="block rounded-pill bg-brand-cta px-4 py-2.5 text-center text-sm font-semibold text-white shadow-cta transition-transform hover:bg-brand-cta-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      Ver Rifa
    </Link>
  );
};

export default RaffleDetailsButton;
