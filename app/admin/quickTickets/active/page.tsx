"use client";
import React, { useEffect, useState } from "react";
import { realtimeDB } from "../../../firebaseconfig"; // Adjust the import path as needed
import {
  ref,
  onValue,
  update,
  query,
  equalTo,
  orderByChild,
  startAt,
} from "firebase/database";
import withAuth from "@/app/components/WithAuth";
import TicketCard from "@/app/components/TicketCard";
import { formatDateLocal } from "@/app/utils/formatDate";

interface Ticket {
  activationCode: string;
  createdAt: string;
  id: string;
  status: string;
  isWinner: boolean;
  symbols: string[];
  claimed?: boolean;
  winnerLevel?: string;
}

const QuickTicketsActivePage = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [winnerTickets, setWinnerTickets] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("pending");
  useEffect(() => {
    const unsubscribe = listenToDB();
    return () => {
      unsubscribe(); // Cleanup listener on unmount
    };
  }, []);
  const listenToDB = () => {
    const quickTicketsCollection = ref(realtimeDB, "quickTickets");

    const unsubscribe = onValue(
      quickTicketsCollection,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const ticketsArray = Object.values(data) as Ticket[];

          // Filter pending tickets
          const pendingTickets = ticketsArray.filter(
            (ticket) => ticket.status === "pending"
          );
          setActiveTickets(pendingTickets);
          setTickets(ticketsArray);

          // 🔹 Get start of today in ms
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const startMs = startOfToday.getTime();
          const endMs = startMs + 24 * 60 * 60 * 1000; // start of next day

          // 🔹 Count tickets purchased today
          const ticketsToday = ticketsArray.filter(
            (ticket) =>
              Number(ticket.createdAt) >= startMs &&
              Number(ticket.createdAt) < endMs
          );
          console.log(
            `Tickets purchased today (${startOfToday.toDateString()}):`,
            ticketsToday.length
          );

          // 🔹 Count winners by category
          type WinnerCategory =
            | "bigWinner"
            | "specialWinner"
            | "regularWinner"
            | "minorWinner"
            | "none";
          const categoryCounts: Record<WinnerCategory, number> = {
            bigWinner: 0,
            specialWinner: 0,
            regularWinner: 0,
            minorWinner: 0,
            none: 0,
          };

          ticketsArray.forEach((ticket) => {
            const category = (ticket.winnerLevel || "none") as WinnerCategory;
            if (categoryCounts.hasOwnProperty(category)) {
              categoryCounts[category]++;
            }
          });

          console.log("Winner counts by category:", categoryCounts);
        } else {
          console.log("No quick tickets found.");
        }
      },
      { onlyOnce: false }
    );

    return unsubscribe;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button
          className='
            bg-gradient-to-b from-blue-400 to-blue-700
            text-white px-4 py-2 rounded shadow
          '
          onClick={() => setSelectedTab("pending")}
        >
          Pending ({activeTickets.length})
        </button>
        <button
          className='
            bg-gradient-to-b from-gray-400 to-gray-700
            text-white px-4 py-2 rounded shadow
          '
          onClick={() => setSelectedTab("all")}
        >
          All ({tickets.length})
        </button>
        <button
          onClick={() => setSelectedTab("winners")}
          className='
            bg-gradient-to-b from-green-400 to-green-700
            text-white px-4 py-2 rounded shadow
          '
        >
          Winners ({tickets.filter((t) => t.isWinner).length})
        </button>
      </div>
      {selectedTab === "pending" && (
        <div>
          <h2>Pending Tickets</h2>
          <ul>
            {activeTickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  activationCode={ticket.activationCode}
                  createdAt={formatDateLocal(ticket.createdAt)}
                  symbols={ticket.symbols}
                  isWinner={ticket.isWinner}
                >
                  <button
                    className='bg-green-500 text-white border-none rounded px-4 py-2 cursor-pointer'
                    onClick={async () => {
                      const ticketRef = ref(
                        realtimeDB,
                        `quickTickets/${ticket.id}`
                      );
                      await update(ticketRef, { status: "active" });
                    }}
                  >
                    Set Active
                  </button>
                </TicketCard>
              </li>
            ))}
          </ul>
        </div>
      )}
      {selectedTab === "all" && (
        <div>
          <h2>All Tickets</h2>
          <ul>
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  activationCode={ticket.activationCode}
                  createdAt={formatDateLocal(ticket.createdAt)}
                  symbols={ticket.symbols}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {selectedTab === "winners" && (
        <div>
          <h2>Winners</h2>
          <ul>
            {tickets
              .filter((ticket) => ticket.isWinner)
              .map((ticket) => (
                <li key={ticket.id}>
                  <TicketCard
                    activationCode={ticket.activationCode}
                    createdAt={formatDateLocal(ticket.createdAt)}
                    symbols={ticket.symbols}
                  >
                    <div className='flex items-center'>
                      <label className='mr-2'>Claimed:</label>
                      <input
                        type='checkbox'
                        className='cursor-pointer'
                        checked={ticket.claimed}
                        onChange={async (e) => {
                          const ticketRef = ref(
                            realtimeDB,
                            `quickTickets/${ticket.id}`
                          );
                          await update(ticketRef, {
                            claimed: e.target.checked,
                          });
                        }}
                      />
                    </div>
                  </TicketCard>
                </li>
              ))}
          </ul>
        </div>
      )}
      {activeTickets.length === 0 && selectedTab === "pending" && (
        <div className='bg-white text-black p-4 rounded-lg shadow'>
          <p>No pending tickets available.</p>
        </div>
      )}
      {tickets.length === 0 && selectedTab === "all" && (
        <div className='bg-white text-black p-4 rounded-lg shadow'>
          <p>No tickets available.</p>
        </div>
      )}
      {tickets.filter((t) => t.isWinner).length === 0 &&
        selectedTab === "winners" && (
          <div className='bg-white text-black p-4 rounded-lg shadow'>
            <p>No winning tickets available.</p>
          </div>
        )}
    </div>
  );
};

export default withAuth(QuickTicketsActivePage);
