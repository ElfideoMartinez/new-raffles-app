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
    const response = await fetch(
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getAllRaffles`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(response);
      throw new Error(`Failed to fetch raffle data: ${response.statusText}`);
    }

    const { result } = await response.json();
    console.log("result", result);

    return (
      <Suspense fallback={<div>Cargando...</div>}>
        <main className='min-h-screen grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-4'>
          {result.map((element: any, index: number) => (
            <Cards key={index} {...element} />
          ))}
        </main>
      </Suspense>
    );
  } catch (error: any) {
    console.error("Error rendering Home page:", error);
    return (
      <main className='min-h-screen flex items-center justify-center'>
        <div className='text-red-500 text-center'>
          <h1>Error loading data</h1>
          <p>{error.message}</p>
        </div>
      </main>
    );
  }
}
