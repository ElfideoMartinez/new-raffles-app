"use client";

import React, { useState, useEffect, useCallback } from "react";
import useTicketStore from "../store";

interface ITicketButtonProps {
  raffleId: string;
  ticketId?: string;
  ticketNumber: number;
  isUnavailable?: boolean;
}

const TicketButton = ({
  raffleId,
  ticketId,
  ticketNumber,
  isUnavailable,
}: ITicketButtonProps) => {
  const [isSelected, setIsSelected] = useState(false);
  const addTicket = useTicketStore((state) => state.addTicket);
  const removeTicket = useTicketStore((state) => state.removeTicket);

  const handleClick = useCallback(() => {
    if (isUnavailable) return;
    console.log("ticketId", ticketId);
    setIsSelected((prevSelected) => {
      const newSelected = !prevSelected;
      if (newSelected) {
        addTicket(ticketNumber, raffleId);
      } else {
        removeTicket(ticketNumber, raffleId);
      }
      return newSelected;
    });
  }, [addTicket, removeTicket, raffleId, ticketNumber]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      className={`m-1 text-white py-2 px-4 rounded ${
        isSelected ? "bg-yellow-400" : "bg-green-500"
      } ${isUnavailable ? "cursor-not-allowed opacity-50 bg-red-500" : ""}`}
      disabled={isUnavailable}
    >
      {ticketNumber}
    </button>
  );
};

export default TicketButton;
