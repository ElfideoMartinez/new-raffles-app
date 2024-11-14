import Image from "next/image";
import Cards from "./components/Cards";
import { Suspense } from "react";
interface IRaffleDataResponse {
  data: number[];
  price: string;
  raffleImage: string;
}

export default async function Home() {
  try {
    console.log(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getAllRaffles`,
      {
        cache: "no-store",
      }
    );
    if (!response.ok) {
      console.error(response);
      throw new Error("Failed to fetch raffle data");
    }
    const { result } = await response.json();
    console.log("result", result);
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <main className='min-h-screen grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4'>
          {result.map((element: any, index: number) => (
            <Cards key={index} {...element} />
          ))}
        </main>
      </Suspense>
    );
  } catch (error) {
    console.error("Error fetching raffle data:", error);
    return <div>Error fetching raffle data</div>;
  }
}
