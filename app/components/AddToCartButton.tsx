"use client";
import React from "react";
import useTicketStore from "../store";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface IAddToCartButtonprops {
  raffleId: string;
  raffleName: string;
  rafflePrice: number;
}

const AddToCartButton = ({ raffleId, raffleName ,rafflePrice }: IAddToCartButtonprops) => {
  const selectedTicketCount = useTicketStore((state) =>
    state.getSelectedTickets(raffleId)
  );
  const addTicketsToCart = useTicketStore((state) => state.addTicketsToCart);
  const router = useRouter();

  return (

    <button
      onClick={() => {
        addTicketsToCart(raffleId, rafflePrice, raffleName);
        // Redirect to the cart page without reloading the page
        router.push("/user/cart", {
          scroll: false,
        });
      }}
      disabled={selectedTicketCount.length < 1}
      className='focus-ring disabled:bg-brand-300 flex items-center justify-center w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-pill'
    >
      Agregar al carrito ({selectedTicketCount.length})
    </button>
  );
};

export default AddToCartButton;
