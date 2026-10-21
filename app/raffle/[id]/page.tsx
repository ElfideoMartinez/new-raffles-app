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
      console.error(responseData);
      throw new Error("Failed to fetch raffle data");
    }
    const result = await responseData.json();
    console.log(result);

    return {
      data: result.data,
      price: result.raffleData.pricePerTicket,
      raffleImage: result.raffleData.awardImage,
      raffleName: result.raffleData.title,
      awardDescription: result.raffleData.awardDescription,
      awardName: result.raffleData.awardName,
      ticketWinner: result.raffleData.ticketWinner || "",
    };
  } catch (error) {
    console.error(error);
    return {
      data: [],
      price: "",
      raffleImage: "",
      raffleName: "",
      awardDescription: "",
      awardName: "",
      ticketWinner: "",
    };
  }
}

const RafflePageServer = async ({ params }: { params: { id: string } }) => {
  const raffleData = await fetchRaffleData(params.id);

  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center mt-5'>
          <FadeLoader color='#ffffff' />
        </div>
      }
    >
      <RafflePageClient raffleData={raffleData} raffleId={params.id} />
    </Suspense>
  );
};

export default RafflePageServer;
