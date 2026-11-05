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
  // Legacy placeholder values ("1.0") from a fixed-odds model this app no
  // longer uses. Not displayed: this is a pari-mutuel pool, so no true odds
  // exist before settlement. The card shows live ticket share instead.
  oddsTeamA?: string;
  oddsTeamB?: string;
  tieBets?: number;
  teams: { a: string; b: string };
  isFinished: boolean;
  // Written by settleBet() when an admin settles the match.
  settled?: boolean;
  result?: "A" | "B" | "C" | "VOID" | string;
  payoutPerTicket?: number;
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
          <ClipLoader color="var(--color-brand-700)" size={50} className='mx-auto mt-20' />
        }
      >
        <main className='min-h-screen p-4'>
          <div className='max-w-7xl mx-auto'>
            <header className='mb-8 text-center'>
              <h1 className='text-balance text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl'>
                Apuestas
              </h1>
              <p className='mt-2 text-sm text-ink-500 sm:text-base'>
                Participa en las que siguen abiertas o consulta las finalizadas.
              </p>
            </header>

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
        <div className='text-danger-700 text-center'>
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
    <div className='rounded-card overflow-hidden border border-ink-100 bg-surface shadow-card transition-shadow duration-300 hover:shadow-lg'>
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
        <h3 className='text-xl font-bold text-ink-900 mb-2 line-clamp-2'>
          {bet.title}
        </h3>

        <p className='text-ink-500 text-sm mb-3 line-clamp-3'>
          {bet.description}
        </p>

        <div className='space-y-2 mb-4'>
          <div className='text-sm text-ink-500'>
            <span className='font-semibold '>Precio por boleto:</span>{" "}
            <span className='text-ink-900'>{formatPrice(bet.pricePerTicket)}</span>
          </div>

          <div className='text-sm text-ink-500'>
            <span className='font-semibold'>Cierre:</span>{" "}
            <span className='text-ink-900'>
              {formatDate(bet.date)}
            </span>
          </div>
        </div>

        {/* Live ticket distribution.
            This is a pari-mutuel pool: payout is pool x (1 - takeRate) /
            winningTickets, computed at settlement. So there is no pre-match
            "odds" to show. The old oddsTeamA/B fields held a hardcoded "1.0"
            placeholder and the tie row printed totalBets/tieBets*100-100
            (nonsense, e.g. -100 or 150). Both are gone; the share of the pool
            is the honest number and it already comes from the counters. */}
        <div className='space-y-2 mb-4'>
          <div className='text-xs uppercase tracking-wide text-ink-500'>
            Reparto actual {totalBets > 0 ? `(${totalBets} boletos)` : ""}
          </div>

          {totalBets === 0 ? (
            <p className='text-sm text-ink-500'>Aún no hay boletos vendidos.</p>
          ) : (
            <>
              <ShareRow
                label={bet.teams.a}
                percent={teamAPercentage}
                barClass='bg-success-700'
              />
              <ShareRow
                label={bet.teams.b}
                percent={teamBPercentage}
                barClass='bg-danger-700'
              />
              {Number(bet.tieBets) > 0 && (
                <ShareRow
                  label='Empate'
                  percent={tiePercentage}
                  barClass='bg-warning-500'
                  labelClass='text-warning-700'
                />
              )}
            </>
          )}
        </div>

        <div className='flex flex-col gap-2'>
          <Link
            href={`/bet/${bet.id}`}
            className={`min-h-11 w-full text-center py-2.5 px-4 rounded-card font-semibold transition-colors duration-300 ${
              bet.isFinished
                ? "bg-ink-100 text-ink-500 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-on-brand"
            }`}
          >
            {bet.isFinished ? "Apuesta Finalizada" : "Participar"}
          </Link>

          {bet.isFinished && (
            <span className='text-center text-xs text-ink-500'>
              {winnerLabel(bet)
                ? winnerLabel(bet)
                : "Esta apuesta ha terminado"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Result line for a settled bet card.
 *
 * settleBet() stores `result` as an outcome letter (A/B/C/VOID). Without this,
 * a finished card only said "terminó", which tells a customer nothing about
 * who won. Returns null when the bet has no result yet, so the caller can fall
 * back to the neutral finished message.
 */
function winnerLabel(bet: IBetData): string | null {
  if (!bet.result) return null;
  if (bet.result === "VOID") return "Apuesta anulada: se reembolsó a los participantes";
  const winner =
    bet.result === "A"
      ? bet.teams?.a
      : bet.result === "B"
      ? bet.teams?.b
      : bet.result === "C"
      ? "Empate"
      : null;
  if (!winner) return null;
  const payout =
    typeof bet.payoutPerTicket === "number" && bet.payoutPerTicket > 0
      ? ` · pago por boleto: $${bet.payoutPerTicket.toFixed(2)}`
      : "";
  return `Ganador: ${winner}${payout}`;
}

/**
 * One outcome's share of the pool: label, percentage and a proportional bar.
 * Percentages are computed by the caller from the ticket counters.
 */
function ShareRow({
  label,
  percent,
  barClass,
  labelClass = "text-ink-900",
}: {
  label: string;
  percent: string;
  barClass: string;
  labelClass?: string;
}) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div>
      <div className='flex items-center justify-between'>
        <span className={`text-sm font-medium ${labelClass}`}>{label}</span>
        <span className='text-sm text-ink-700'>{percent}%</span>
      </div>
      <div className='mt-1 h-1.5 w-full rounded-full bg-ink-100'>
        <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
