"use client";

import { useEffect, useState, useRef } from "react";
import { onValue, ref, set, off } from "firebase/database";
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
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    console.log("Component mounted, checking for existing ticket...");
    // Get ticket id from localStorage and listen to ticket data from Firebase
    const localTicketId = localStorage.getItem("ticketId");
    if (localTicketId) {
      console.log("Found local ticket ID:", localTicketId);
      listenToTicket(localTicketId);
    } else {
      console.log("No local ticket found, creating new ticket...");
      createNewTicket();
    }

    // Cleanup function to remove listener when component unmounts
    return () => {
      console.log("Component unmounting, cleaning up listener...");
      if (listenerRef.current) {
        off(listenerRef.current);
        listenerRef.current = null;
      }
    };
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
  }, [scratchedCardsCount, ticket]);

  const clearLocalTicket = () => {
    localStorage.removeItem("ticketId");
  };

  const createNewTicket = async () => {
    console.log("=== CREATING NEW TICKET ===");
    setIsLoading(true);
    setScratchedCardsCount(0);
    try {
      // Call backend to create a new ticket
      const response = await fetch(
        `https://createquickticket-3ve3qo4dga-uc.a.run.app`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Response data:", result);
      const { data } = result;

      console.log("New ticket created:", data);
      //clear any existing local ticket
      clearLocalTicket();
      // Save only the ticket id in localStorage
      localStorage.setItem("ticketId", data.id);
      console.log("Saved ticket ID to localStorage:", data.id);

      setTicket(data);
      listenToTicket(data.id);
      setIsLoading(false);
    } catch (error) {
      console.error("=== ERROR CREATING TICKET ===");
      console.error("Error details:", error);
      setError({
        code: "ticket_creation_error",
        message: "Error creating new ticket. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const listenToTicket = (id: string) => {
    console.log("=== SETTING UP LISTENER ===");
    console.log("Ticket ID:", id);
    console.log("Firebase DB instance:", realtimeDB);

    // Clean up any existing listener
    if (listenerRef.current) {
      console.log("Cleaning up existing listener...");
      off(listenerRef.current);
    }

    const itemRef = ref(realtimeDB, `quickTickets/${id}`);
    console.log("Firebase reference path:", `quickTickets/${id}`);
    console.log("Firebase reference object:", itemRef);

    // Set up the new listener
    const unsubscribe = onValue(
      itemRef,
      (snapshot) => {
        console.log("=== FIREBASE CALLBACK TRIGGERED ===");
        console.log("Snapshot exists:", snapshot.exists());
        console.log("Snapshot value:", snapshot.val());
        console.log("Timestamp:", new Date().toISOString());

        if (snapshot.exists()) {
          const ticketData = snapshot.val();
          console.log("Setting ticket data:", ticketData);
          setTicket(ticketData);

          // Only clear if expired, not if finished
          if (ticketData.status === "finnished") {
            console.log("Ticket is finished, clearing local storage...");
            clearLocalTicket();
          }
        } else {
          console.warn("=== TICKET NOT FOUND IN DATABASE ===");
          console.warn("Clearing local storage and creating new ticket...");
          clearLocalTicket();
          createNewTicket();
        }
      },
      (error) => {
        console.error("=== FIREBASE LISTENER ERROR ===");
        console.error("Error details:", error);
        setError({
          code: "firebase_error",
          message:
            "Error connecting to Firebase. Please check your connection.",
        });
      }
    );

    // Store the listener reference for cleanup
    listenerRef.current = itemRef;
    console.log("Listener setup complete");
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
      {isLoading ? (
        <p className='text-gray-500'>Cargando tu boleto...</p>
      ) : (
        <p className='text-gray-600 mb-4'>
          {ticket?.id ? `Ticket ID: ${ticket.id}` : "No ticket found."}
        </p>
      )}
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
