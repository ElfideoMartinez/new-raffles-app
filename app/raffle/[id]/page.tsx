// app/raffle/[id]/RafflePageServer.tsx

import { apiUrl } from "@/app/config/api";
import React, { Suspense, createContext } from "react";
import RafflePageClient from "./RafflePageClient";
import { FadeLoader } from "react-spinners";

interface IRaffleDataResponse {
  data: { number: number; sold: boolean; id: string }[];
  price: string;
  raffleImage: string;
  raffleName: string;
  awardDescription: string;
  awardName: string;
  ticketWinner: string;
  /**
   * Set when the fetch or the payload shape failed. F23: this used to be
   * swallowed into empty strings, which rendered a page that looked valid
   * ("Premio:" with nothing after it) and hid the real failure. Callers must
   * check this and render an error card instead.
   */
  error?: string;
}

async function fetchRaffleData(id: string): Promise<IRaffleDataResponse> {
  try {
    const responseData = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getRaffleData`,
      apiUrl("getRaffleData"),
      {
        cache: "no-store",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      }
    );
    if (!responseData.ok) {
      console.error("getRaffleData failed:", responseData.status);
      return failedRaffleData(`HTTP ${responseData.status}`);
    }

    const result = await responseData.json();

    // The deployed function answers FLAT: { raffleData, data } at the top
    // level (verified with POST getRaffleData -> {"data":null}). Do not add a
    // `result.result` unwrap here without re-checking the endpoint first.
    if (!result?.raffleData) {
      console.error("getRaffleData returned no raffleData:", result);
      return failedRaffleData("Sin datos de la rifa");
    }

    return {
      data: Array.isArray(result.data) ? result.data : [],
      price: result.raffleData.pricePerTicket,
      raffleImage: result.raffleData.awardImage,
      raffleName: result.raffleData.title,
      awardDescription: result.raffleData.awardDescription,
      awardName: result.raffleData.awardName,
      ticketWinner: result.raffleData.ticketWinner || "",
    };
  } catch (error) {
    console.error(error);
    return failedRaffleData(
      error instanceof Error ? error.message : "Error desconocido"
    );
  }
}

/** Empty payload that still carries the failure, so the page can say so. */
function failedRaffleData(error: string): IRaffleDataResponse {
  return {
    data: [],
    price: "",
    raffleImage: "",
    raffleName: "",
    awardDescription: "",
    awardName: "",
    ticketWinner: "",
    error,
  };
}

const RafflePageServer = async ({ params }: { params: { id: string } }) => {
  const raffleData = await fetchRaffleData(params.id);

  if (raffleData.error) {
    return (
      <main className="mt-16 flex items-center justify-center">
        <div className="max-w-md rounded-card border border-danger-500/20 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-bold text-ink-900">
            No se pudo cargar la rifa
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Intenta de nuevo en un momento.
          </p>
          <p className="mt-3 rounded-sm bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {raffleData.error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center mt-5'>
          <FadeLoader color="var(--color-ink-inverse)" />
        </div>
      }
    >
      <RafflePageClient raffleData={raffleData} raffleId={params.id} />
    </Suspense>
  );
};

export default RafflePageServer;
