"use client";
import React from "react";
import useTicketStore from "../store";
import { useRouter } from "next/navigation";

interface IAddToCartButtonprops {
  raffleId: string;
  rafflePrice: number;
}

const AddToCartButton = ({ raffleId, rafflePrice }: IAddToCartButtonprops) => {
  const selectedTicketCount = useTicketStore((state) =>
    state.getSelectedTickets(raffleId)
  );
  const addTicketsToCart = useTicketStore((state) => state.addTicketsToCart);
  const router = useRouter();

  return (
    <button
      onClick={() => {
        addTicketsToCart(raffleId, rafflePrice);
        router.push("/user/cart");
      }}
      disabled={selectedTicketCount.length < 1}
      className='disabled:bg-gray-500 flex items-center justify-center w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
    >
      Add to Cart ({selectedTicketCount.length})
    </button>
  );
};

export default AddToCartButton;
