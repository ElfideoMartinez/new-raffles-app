import { apiUrl } from "@/app/config/api";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ClipLoader } from "react-spinners";
import { formatDate, formatPrice } from "@/app/utils/format";

interface IBetData {
  id: string;
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  image: string;
  title: string;
  date: string;
  description: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  oddsTeamA: string;
  oddsTeamB: string;
  tieBets?: number;
  teams: { a: string; b: string };
  isFinished: boolean;
}
export default async function BetsPage() {
  try {
    const response = await fetch(
      apiUrl("getAllBets"),
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(response);
      throw new Error(`Failed to fetch bets data: ${response.statusText}`);
    }

    const { result } = await response.json();

    if (!result || result.length === 0) {
      return (
        <main className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-ink-900 mb-4'>
              No hay apuestas disponibles
            </h1>
            <p className='text-ink-500'>
              Vuelve pronto para ver nuevas apuestas
            </p>
          </div>
        </main>
      );
    }

    return (
      <Suspense
        fallback={
          <ClipLoader color="var(--color-ink-inverse)" size={50} className='mx-auto mt-20' />
        }
      >
        <main className='min-h-screen p-4'>
          <div className='max-w-7xl mx-auto'>
            <h1 className='text-3xl font-bold text-ink-900 text-center mb-8'>
              Apuestas Disponibles
            </h1>

            <div className='grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
              {result.map((bet: IBetData) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          </div>
        </main>
      </Suspense>
    );
  } catch (error: any) {
    console.error("Error rendering Bets page:", error);
    return (
      <main className='min-h-screen flex items-center justify-center'>
        <div className='text-red-500 text-center'>
          <h1 className='text-2xl font-bold mb-4'>No se pudieron cargar las apuestas</h1>
          <p>{error.message}</p>
          <p className='text-ink-500 mt-2'>Intenta de nuevo en un momento.</p>
        </div>
      </main>
    );
  }
}

function BetCard({ bet }: { bet: IBetData }) {
  const totalBets = bet.betsTeamA + bet.betsTeamB + (bet.tieBets || 0);
  const teamAPercentage =
    totalBets > 0 ? ((bet.betsTeamA / totalBets) * 100).toFixed(1) : "0";
  const teamBPercentage =
    totalBets > 0 ? ((bet.betsTeamB / totalBets) * 100).toFixed(1) : "0";
  const tiePercentage =
    totalBets > 0 && bet.tieBets
      ? ((bet.tieBets / totalBets) * 100).toFixed(1)
      : "0";

  return (
    <div className='bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300'>
      {bet.image && (
        <div className='relative h-48 w-full'>
          <Image
            src={bet.image}
            alt=""
            fill
            className='object-cover'
          />
        </div>
      )}

      <div className='p-4'>
        <h3 className='text-xl font-bold text-white mb-2 line-clamp-2'>
          {bet.title}
        </h3>

        <p className='text-gray-300 text-sm mb-3 line-clamp-3'>
          {bet.description}
        </p>

        <div className='space-y-2 mb-4'>
          <div className='text-sm text-gray-400'>
            <span className='font-semibold '>Precio por boleto:</span>{" "}
            <span className='text-white'>{formatPrice(bet.pricePerTicket)}</span>
          </div>

          <div className='text-sm text-gray-400'>
            <span className='font-semibold'>Cierre:</span>{" "}
            <span className='text-white'>
              {formatDate(bet.date)}
            </span>
          </div>
        </div>

        {/* Teams and betting stats */}
        <div className='space-y-2 mb-4'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-green-400'>
              {bet.teams.a}
            </span>
            <span
              className={`text-sm text-gray-300
              ${bet.oddsTeamA.includes("+") ? "text-green-400" : "text-red-400"}
              `}
            >
              {bet.oddsTeamA}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-red-400'>
              {bet.teams.b}
            </span>
            <span
              className={`text-sm text-gray-300
              ${bet.oddsTeamB.includes("+") ? "text-green-400" : "text-red-400"}
              `}
            >
              {bet.oddsTeamB}
            </span>
          </div>

          {bet.tieBets !== undefined && (
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-yellow-400'>
                Empate
              </span>
              <span className='text-sm text-gray-300'>
                {((totalBets / (bet.tieBets || 1)) * 100 - 100).toFixed(0)}
              </span>
            </div>
          )}
        </div>

        <div className='flex flex-col gap-2'>
          <Link
            href={`/bet/${bet.id}`}
            className={`w-full text-center py-2 px-4 rounded-md font-semibold transition-colors duration-300 ${
              bet.isFinished
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {bet.isFinished ? "Apuesta Finalizada" : "Participar"}
          </Link>

          {bet.isFinished && (
            <span className='text-center text-xs text-gray-500'>
              Esta apuesta ha terminado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
