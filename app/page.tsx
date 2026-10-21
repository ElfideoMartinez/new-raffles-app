import { apiUrl } from "@/app/config/api";
import Cards from "./components/Cards";
import { Suspense } from "react";
import { toRaffle, type AllRafflesResponse } from "./config/types";

export default async function Home() {
  try {
    const response = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getAllRaffles`,
      apiUrl("getAllRaffles"),
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(response);
      throw new Error(`Failed to fetch raffle data: ${response.statusText}`);
    }

    const { result } = (await response.json()) as AllRafflesResponse;
    const raffles = (Array.isArray(result) ? result : []).map(toRaffle);

    return (
      <Suspense fallback={<div>Cargando...</div>}>
        <main className="mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
              Rifas activas
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Elige una rifa y compra tus boletos en linea.
            </p>
          </div>
          {raffles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {raffles.map((raffle) => (
                <Cards key={raffle.id} {...raffle} />
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-ink-100 bg-white p-10 text-center shadow-card">
              <p className="text-lg font-semibold text-ink-900">
                No hay rifas activas
              </p>
              <p className="mt-1 text-sm text-ink-500">
                Vuelve pronto para ver las nuevas rifas.
              </p>
            </div>
          )}
        </main>
      </Suspense>
    );
  } catch (error: unknown) {
    console.error("Error rendering Home page:", error);
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return (
      <main className="mt-16 flex items-center justify-center">
        <div className="max-w-md rounded-card border border-danger-500/20 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-bold text-ink-900">
            No se pudieron cargar las rifas
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Intenta de nuevo en un momento.
          </p>
          <p className="mt-3 rounded bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {message}
          </p>
        </div>
      </main>
    );
  }
}
