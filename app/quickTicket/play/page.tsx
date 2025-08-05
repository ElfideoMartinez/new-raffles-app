"use client";

import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { realtimeDB } from "../../firebaseconfig"; // Adjust the import path as needed
import { ScratchCard } from "next-scratchcard";

type Errortype = {
  code: string;
  message: string;
};

const WinnerLevelPrizes: { [key: string]: string } = {
  none: "No Premio",
  bigWinner: "Premio Grane",
  specialWinner: "Premio Special",
  regularWinner: "Premio Regular",
  minorWinner: "Premio Chico",
};

export default function PlayPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Errortype | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [scratchedCardsCount, setScratchedCardsCount] = useState(0);

  useEffect(() => {
    // Get ticket id from localStorage and listen to ticket data from Firebase
    const localTicketId = localStorage.getItem("ticketId");
    if (localTicketId) {
      listenToTicket(localTicketId);
      console.log("Using local ticket id:", localTicketId);
    } else {
      createNewTicket();
    }
  }, []);

  useEffect(() => {
    if (
      scratchedCardsCount >= 6 &&
      ticket?.id &&
      ticket.status !== "finnished"
    ) {
      set(ref(realtimeDB, `quickTickets/${ticket.id}`), {
        ...ticket,
        status: "finnished",
      });
      console.log("Ticket status updated to 'finnished' in Firebase.");
      clearLocalTicket();
    }
  }, [scratchedCardsCount]);

  const clearLocalTicket = () => {
    localStorage.removeItem("ticketId");
  };

  const createNewTicket = async () => {
    setIsLoading(true);
    setScratchedCardsCount(0);
    try {
      // Call backend to create a new ticket
      const response = await fetch(
        `http://127.0.0.1:3001/raffleapp-dbc1b/us-central1/createQuickTicket`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();
      console.log("New ticket created:", data);
      //clear any existing local ticket
      clearLocalTicket();
      // Save only the ticket id in localStorage
      localStorage.setItem("ticketId", data.id);
      setTicket(data);
      listenToTicket(data.id);
      setIsLoading(false);
    } catch (error) {
      console.error("Error creating new ticket:", error);
      setError({
        code: "ticket_creation_error",
        message: "Error creating new ticket. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const listenToTicket = (id: string) => {
    console.log("Listening to ticket updates for ID:", id);
    const itemRef = ref(realtimeDB, `quickTickets/${id}`);
    onValue(itemRef, (snapshot) => {
      if (snapshot.exists()) {
        const ticketData = snapshot.val();
        setTicket(ticketData);
        // Only clear if expired, not if finished
        if (ticketData.status === "finnished") {
          clearLocalTicket();
          console.log(ticketData);
          //change to finished
          set(ref(realtimeDB, `quickTickets/${id}`), {
            ...ticketData,
            status: "finnished",
          });
        }
      } else {
        // Ticket not found, clear local ticket
        clearLocalTicket();
        console.warn("Ticket not found in database, clearing local storage.");
        createNewTicket();
      }
    });
  };

  if (error && !ticket) {
    return (
      <main className='max-h-96 flex flex-col items-center justify-center text-center p-4 sm:p-0'>
        <h1 className='text-2xl font-bold mb-2 mt-10'>Error</h1>
        <p className='text-red-500'>{error.message}</p>
        <button
          className='mt-4 bg-blue-500 text-white px-4 py-2 rounded'
          onClick={createNewTicket}
        >
          Try Again
        </button>
      </main>
    );
  }

  return (
    <main className='max-h-96 flex flex-col items-center justify-center text-center p-4 sm:p-0'>
      <h1 className='text-2xl font-bold mb-2 mt-10'>🎟️ Rascadito Rapido</h1>
      {isLoading && <p>Loading ticket...</p>}
      {!isLoading && !ticket && (
        <p className='text-red-500'>No ticket found. Please try again.</p>
      )}
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
          <div className='bg-white flex flex-col rounded-lg shadow-lg p-4 w-full'>
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
            <div className='flex justify-center'>
              <div className='grid grid-cols-3 grid-rows-2 gap-4 sm:gap-6 md:gap-8 w-full max-w-md md:max-w-lg lg:max-w-xl mx-auto my-4'>
                {ticket.symbols.map((s: any, i: any) => (
                  <ScratchCard
                    image='/icon.png'
                    key={i}
                    width={80}
                    height={80}
                    onComplete={() => {
                      console.log(`Symbol ${i + 1} scratched!`);
                      setScratchedCardsCount((prev) => prev + 1);
                      navigator.vibrate(100);
                    }}
                    finishPercent={50}
                  >
                    <div
                      className='flex items-center justify-center h-full w-full bg-slate-400 rounded-lg shadow-lg text-4xl sm:text-5xl select-none touch-none'
                      style={{
                        userSelect: "none",
                        touchAction: "none",
                        WebkitUserSelect: "none",
                        msUserSelect: "none",
                        MozUserSelect: "none",
                      }}
                      draggable={false}
                    >
                      {s}
                    </div>
                  </ScratchCard>
                ))}
              </div>
            </div>
            {scratchedCardsCount === ticket.symbols.length && (
              <>
                {ticket.isWinner ? (
                  <p className='text-2xl text-green-700 font-bold'>
                    🎉 Ganaste {WinnerLevelPrizes[String(ticket.winnerLevel)]}
                  </p>
                ) : (
                  <p className='text-2xl text-red-700 font-bold'>
                    Lo sentimos, no ganaste esta vez.
                  </p>
                )}
                <button
                  className='mt-4 bg-blue-500 text-white px-4 py-2 w-max self-center rounded-md bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-700 transition-colors'
                  onClick={createNewTicket}
                >
                  Jugar de nuevo
                </button>
              </>
            )}
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
