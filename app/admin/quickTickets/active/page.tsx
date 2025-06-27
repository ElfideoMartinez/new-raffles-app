"use client";
import React, { useEffect, useState } from "react";
import { realtimeDB } from "../../../firebaseconfig"; // Adjust the import path as needed
import { ref, onValue, update } from "firebase/database";

interface Ticket {
  activationCode: string;
  createdAt: string;
  id: string;
  status: string;
  isWinner: boolean;
  symbols: string[];
  claimed?: boolean;
}

const page = () => {
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
    //reference to to quickTicketsCollection
    const quickTicketsCollection = ref(realtimeDB, "quickTickets");
    // Listen to changes in the quickTicketsCollection
    const unsubscribe = onValue(
      quickTicketsCollection,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log("Quick Tickets Data:", data);
          const ticketsArray = Object.values(data) as Ticket[];
          const pendingTickets = ticketsArray.filter(
            (ticket) => ticket.status === "pending"
          );
          setActiveTickets(pendingTickets);

          setTickets(ticketsArray);
        } else {
          console.log("No quick tickets found.");
        }
      },
      {
        onlyOnce: false, // Keep listening for changes
      }
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
              <li
                key={ticket.id}
                className='bg-white text-black p-4 rounded-lg mb-4 shadow flex justify-between items-center'
              >
                <div>
                  <div>
                    <strong>Activation Code:</strong>
                    <span className='text-green-500 font-bold'>
                      {ticket.activationCode}
                    </span>
                  </div>
                  <div>
                    <strong>Created At:</strong> {ticket.createdAt}
                  </div>
                  <div>
                    <strong>Symbols:</strong> {ticket.symbols?.join(", ")}
                  </div>
                  <div>
                    <strong>Status:</strong> {ticket.status}
                  </div>
                </div>
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
              <li
                key={ticket.id}
                className='bg-white text-black p-4 rounded-lg mb-4 shadow flex justify-between items-center'
              >
                <div>
                  <div>
                    <strong>Activation Code:</strong>
                    <span className='text-green-500 font-bold'>
                      {ticket.activationCode}
                    </span>
                  </div>
                  <div>
                    <strong>Created At:</strong> {ticket.createdAt}
                  </div>
                  <div>
                    <strong>Symbols:</strong> {ticket.symbols?.join(", ")}
                  </div>
                  <div>
                    <strong>Status:</strong> {ticket.status}
                  </div>
                </div>
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
                <li
                  key={ticket.id}
                  className='bg-white text-black p-4 rounded-lg mb-4 shadow flex justify-between items-center'
                >
                  <div>
                    <div>
                      <strong>Activation Code:</strong>
                      <span className='text-green-500 font-bold'>
                        {ticket.activationCode}
                      </span>
                    </div>
                    <div>
                      <strong>Created At:</strong> {ticket.createdAt}
                    </div>
                    <div>
                      <strong>Symbols:</strong> {ticket.symbols?.join(", ")}
                    </div>
                    <div>
                      <strong>Status:</strong> {ticket.status}
                    </div>
                  </div>
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

export default page;
