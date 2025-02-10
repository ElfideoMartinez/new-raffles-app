// app/raffle/[id]/RafflePageServer.tsx

import React, { Suspense } from "react";
import RafflePageClient from "./RafflePageClient";
import { FadeLoader } from "react-spinners";

interface IRaffleDataResponse {
  data: { number: number; sold: boolean; id: string }[];
  price: string;
  raffleImage: string;
  raffleName: string;
}

async function fetchRaffleData(id: string): Promise<IRaffleDataResponse> {
  try {
    console.log(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getRaffleData`
    );
    const responseData = await fetch(
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getRaffleData`,
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

    return {
      data: result.data,
      price: result.raffleData.pricePerTicket,
      raffleImage: result.raffleData.awardImage,
      raffleName: result.raffleData.title,
    };
  } catch (error) {
    console.error(error);
    return {
      data: [],
      price: "",
      raffleImage: "",
      raffleName: "",
    };
  }
}

const RafflePageServer = async ({ params }: { params: { id: string } }) => {
  const raffleData = await fetchRaffleData(params.id);

  return (
    <Suspense fallback={<FadeLoader color='#ffffff' />}>
      <RafflePageClient raffleData={raffleData} raffleId={params.id} />
    </Suspense>
  );
};

export default RafflePageServer;
