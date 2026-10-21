import Image from "next/image";
import React from "react";
import RaffleDetailsButton from "./RaffleDetailsButton";
import type { Raffle } from "@/app/config/types";
import { formatDate, formatPrice } from "@/app/utils/format";

export type ICardsProps = Raffle;

/**
 * Storefront raffle card.
 *
 * Reworked 2026-10-20:
 *  - uses next/image (was a raw <img> despite next/image being imported and
 *    unused) so images are lazily loaded and size-negotiated
 *  - fixed 4:3 frame with object-cover instead of object-fill, which was
 *    distorting raffle artwork
 *  - restores the tickets-left figure that was computed and passed in but had
 *    its display commented out
 *  - shows a sold-out state (progress reaches 100%)
 *  - brand tokens instead of ad hoc slate/gray classes
 */
const Cards = ({
  id,
  title,
  numberOfTickets,
  ticketsLeft,
  pricePerTicket,
  date,
  awardImage,
}: ICardsProps) => {
  const total = numberOfTickets || 0;
  const left = typeof ticketsLeft === "number" ? ticketsLeft : null;
  const sold = left !== null && total > 0 ? total - left : 0;
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const isSoldOut = left !== null && left <= 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-100">
        {awardImage ? (
          <Image
            src={awardImage}
            /* Empty on purpose: the card already renders the title as <h2> right
               below, so a text alt makes screen readers announce it twice. */
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">
            Sin imagen
          </div>
        )}

        {left !== null && (
          <span
            className={`absolute right-3 top-3 rounded-pill px-3 py-1 text-xs font-semibold ${
              isSoldOut
                ? "bg-danger-700 text-white"
                : "bg-white/95 text-ink-700 shadow-sm"
            }`}
          >
            {isSoldOut ? "Agotada" : `${left} restantes`}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="mb-1 text-lg font-bold leading-snug text-ink-900">
          {title || "Event"}
        </h2>

        <p className="mb-3 text-2xl font-extrabold text-ink-900">
          {formatPrice(pricePerTicket)}
          <span className="ml-1 text-sm font-medium text-ink-500">/ boleto</span>
        </p>

        {total > 0 && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-ink-500">
              <span>
                {sold} de {total} vendidos
              </span>
              <span>{pct}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-pill bg-ink-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso de venta"
            >
              <div
                className="h-full rounded-pill bg-brand-cta transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <p className="mt-auto text-sm text-ink-500">Fecha final: {formatDate(date)}</p>
      </div>

      <div className="px-4 pb-4">
        <RaffleDetailsButton id={id} price={pricePerTicket} />
      </div>
    </article>
  );
};

export default Cards;
