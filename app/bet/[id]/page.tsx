// app/raffle/[id]/RafflePageServer.tsx

import React, { Suspense, createContext } from "react";
import BetPageClient from "./BetPageClient";
import { FadeLoader } from "react-spinners";

interface IBetDataResponse {
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  betImage: string;
  betTitle: string;
  date: string;
  betDescription: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  teams: Array<string>;
}

async function fetchBetData(id: string): Promise<IBetDataResponse> {
  try {
    // console.log(
    //   `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getRaffleData`
    // );
    const responseData = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getBetData`,
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getBetData`,
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
      throw new Error("Failed to fetch bet data");
    }
    const result = await responseData.json();
    console.log(result);

    return {
      data: result.data,
      pricePerTicket: result.betData.pricePerTicket,
      betImage: result.betData.image,
      betTitle: result.betData.title,
      betDescription: result.betData.description,
      date: result.betData.date,
      betsTeamA: result.betData.betsTeamA,
      betsTeamB: result.betData.betsTeamB,
      initialPool: result.betData.initialPool,
      teams: result.betData.teams,
    };
  } catch (error) {
    console.error(error);
    return {
      data: [],
      pricePerTicket: "",
      betImage: "",
      betTitle: "",
      betDescription: "",
      date: "",
      betsTeamA: 0,
      betsTeamB: 0,
      initialPool: 0,
      teams: []
    };
  }
}


const BetPageServer = async ({ params }: { params: { id: string } }) => {
  const betData = await fetchBetData(params.id);

  return ( 
    <Suspense fallback={<div className="flex justify-center items-center mt-5"><FadeLoader color='#ffffff' /></div>}>
      <BetPageClient betData={betData} betId={params.id} />
    </Suspense>
  );
};

export default BetPageServer;
