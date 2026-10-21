"use client";

import React, { useState, useEffect, useCallback } from "react";
import useTicketStore from "../store";
import { toast } from "nextjs-toast-notify";

interface ITicketButtonProps {
  raffleId: string;
  ticketId?: string;
  ticketNumber: number;
  isUnavailable?: boolean;
  inTheCart: boolean;
  isSelectedPrev: boolean;
}

const TicketButton = ({
  raffleId,
  ticketId,
  ticketNumber,
  isUnavailable,
  inTheCart,
  isSelectedPrev,
}: ITicketButtonProps) => {
  const [isSelected, setIsSelected] = useState(false);
  const addTicket = useTicketStore((state) => state.addTicket);
  const removeTicket = useTicketStore((state) => state.removeTicket);

  useEffect(() => {
    setIsSelected(isSelectedPrev);
  }, [isSelectedPrev]);

  useEffect(() => {
    if (isSelected) {
      addTicket(ticketNumber, raffleId);
    } else {
      removeTicket(ticketNumber, raffleId);
    }
  }, [isSelected, addTicket, removeTicket, raffleId, ticketNumber]);

  const handleClick = useCallback(() => {
    if (isUnavailable || inTheCart) return;
    setIsSelected((prev) => !prev);
  }, [isUnavailable, inTheCart]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (inTheCart) {
          toast.warning(`El boleto ${ticketNumber} ya está en el carrito`,{
            duration: 2000,
            progress: false,
            position: 'top-right',
            transition: 'popUp',
            icon: '',
            sound: false,
          });
          return;
        }
        handleClick();
      }}
      aria-pressed={!isUnavailable && !inTheCart ? isSelected : undefined}
      aria-label={
        isUnavailable
          ? `Boleto ${ticketNumber} vendido`
          : inTheCart
          ? `Boleto ${ticketNumber}, ya en el carrito`
          : `Boleto ${ticketNumber}`
      }
      className={`m-1 text-white py-2 px-4 rounded-pill 
        ${isUnavailable ? "cursor-not-allowed opacity-50 bg-brand-500 capitalize" : ""}
        ${inTheCart ? "bg-yellow-400" : ""}
        ${!inTheCart && !isUnavailable && (isSelected ? "bg-yellow-400" : "bg-green-500")}
      `}
      disabled={isUnavailable}
    >
      {isUnavailable ? 'x': ticketNumber}
    </button>
  );
};

export default TicketButton;
