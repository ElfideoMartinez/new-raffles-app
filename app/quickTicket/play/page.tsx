"use client";

import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { realtimeDB } from "../../firebaseconfig"; // Adjust the import path as needed
import { ScratchCard } from "next-scratchcard";

export default function PlayPage() {
  const [ticket, setTicket] = useState<any>(null);
  const [scratchedCardsCount, setScratchedCardsCount] = useState(0);

  useEffect(() => {
    // Get ticket id from localStorage and listen to ticket data from Firebase
    let unSub: () => void;
    const localTicketId = localStorage.getItem("ticketId");
    if (localTicketId) {
      unSub = listenToTicket(localTicketId);
      console.log("Using local ticket id:", localTicketId);
    } else {
      unSub = createNewTicket() as any;
    }
    return () => {
      if (unSub) {
        unSub(); // Cleanup listener on unmount
      }
    };
  }, []);

  useEffect(() => {
    if (scratchedCardsCount >= 6 && ticket?.id) {
      set(ref(realtimeDB, `quickTickets/${ticket.id}`), {
        ...ticket,
        status: "finnished",
      });
    }
  }, [scratchedCardsCount, ticket]);

  const clearLocalTicket = () => {
    localStorage.removeItem("ticketId");
  };

  const createNewTicket = async () => {
    // Call backend to create a new ticket
    const response = await fetch(
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/createQuickTicket`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      console.error("Failed to create new ticket");
      return;
    }
    const { data } = await response.json();
    console.log("New ticket created:", data);
    // Save only the ticket id in localStorage
    localStorage.setItem("ticketId", data.id);
    const unSub = listenToTicket(data.id);
    return unSub;
  };

  const listenToTicket = (id: string) => {
    console.log("Listening to ticket updates for ID:", id);
    const itemRef = ref(realtimeDB, `quickTickets/${id}`);
    const unSub = onValue(itemRef, (snapshot) => {
      if (snapshot.exists()) {
        const ticketData = snapshot.val();
        setTicket(ticketData);
        // Only clear if expired, not if finished
        if (ticketData.status === "finnished") {
          clearLocalTicket();
        }
      } else {
        // Ticket not found, clear local ticket
        clearLocalTicket();
      }
    });
    return unSub;
  };

  return (
    <main className='max-h-screen flex flex-col items-center justify-center text-center p-4'>
      <h1 className='text-3xl font-bold mb-4'>🎟️ Rascadito Rapido</h1>

      {!ticket?.id && <p>Loading ticket...</p>}
      {ticket?.id && ticket?.status === "pending" && (
        <div className='mb-6'>
          <p className='text-lg text-white font-semibold'>
            Muestra este código al cajero para activar tu boleto.
          </p>
          <div className='bg-white rounded-lg shadow-lg p-8'>
            <p className='text-4xl text-black font-bold text-center'>
              {ticket?.activationCode}
            </p>
          </div>
          <p className='text-sm text-gray-600'>
            Espera a que el cajero escanee o ingrese el código para participar.
          </p>
        </div>
      )}

      {(ticket?.status === "active" || ticket?.status === "finnished") &&
        ticket.symbols && (
          <div className='bg-white rounded-lg shadow-lg p-8 w-full'>
            {scratchedCardsCount >= 6 ? (
              <p className='text-2xl text-blue-700 font-bold mb-4'>
                {ticket.isWinner
                  ? "¡Felicidades! Has ganado un premio."
                  : "Gracias por participar. Tu boleto ha sido procesado."}
              </p>
            ) : (
              <p className='mb-2 text-green-600 font-semibold'>
                ¡Tu boleto está activo! Raspa los símbolos para descubrir tu
                premio.
              </p>
            )}
            <div className='grid grid-cols-3 grid-rows-2 gap-2 text-5xl my-4 bg-white rounded-lg max-w-full max-h-max'>
              {ticket.symbols.map((s: any, i: any) => (
                <ScratchCard
                  key={i}
                  width={100}
                  height={100}
                  onComplete={() => {
                    console.log(`Symbol ${i + 1} scratched!`);
                    setScratchedCardsCount((prev) => prev + 1);
                    navigator.vibrate(100);
                  }}
                  finishPercent={50}
                >
                  <div className='flex items-center justify-center h-full bg-slate-400 rounded-lg shadow-lg'>
                    {s}
                  </div>
                </ScratchCard>
              ))}
            </div>
            {scratchedCardsCount === ticket.symbols.length &&
              (ticket.isWinner ? (
                <p className='text-2xl text-green-700 font-bold'>
                  🎉 Ganaste {ticket.prize}!
                </p>
              ) : (
                <p className='text-2xl text-red-700 font-bold'>
                  Lo sentimos, no ganaste esta vez.
                </p>
              ))}
          </div>
        )}

      {ticket?.claimed && (
        <p className='text-red-500'>
          Ticket finalizado. Para jugar de nuevo, refresca la página.
        </p>
      )}
    </main>
  );
}
