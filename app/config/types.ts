// Shared data contract for raffles.
//
// SINGLE SOURCE OF TRUTH
// Raffles are served by the `getAllRaffles` Cloud Function (functions/src/index.ts),
// which returns `{ result: [{ id, ...raffleDoc }] }` from the `raffles`
// collection. The Next route handler `app/api/allraffles/route.ts` used to
// expose the same data a second way; it has been removed (see
// docs/security-consistency-notes.md) so there is one path only.
//
// Firestore raffle documents (written by admin/create/raffle) carry the fields
// below. `numberOfTickets` and `pricePerTicket` are stored as strings in older
// documents (form input) and as numbers in newer ones, so both are accepted and
// normalised by `toRaffle`.

/** Raw shape as it comes off the API / Firestore. Field types are permissive on purpose. */
export interface RaffleRaw {
  id: string;
  title?: string;
  date?: string;
  numberOfTickets?: string | number;
  pricePerTicket?: string | number;
  awardName?: string;
  awardDescription?: string;
  awardImage?: string;
  ticketWinner?: string;
  /** Number of tickets still unsold, when the producer provides it. */
  tickets_left?: number;
  [key: string]: unknown;
}

/** Normalised shape consumed by the UI. */
export interface Raffle {
  id: string;
  title: string;
  date: string;
  numberOfTickets: number;
  pricePerTicket: number;
  awardName: string;
  awardDescription: string;
  awardImage: string;
  ticketWinner: string;
  /** `null` when the source does not report it; never invented. */
  ticketsLeft: number | null;
}

/** Payload of the `getAllRaffles` Cloud Function. */
export interface AllRafflesResponse {
  result: RaffleRaw[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Normalise a raw raffle document into the UI `Raffle` shape. */
export function toRaffle(raw: RaffleRaw): Raffle {
  const ticketsLeft = toNumber(raw.tickets_left);
  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "",
    date: typeof raw.date === "string" ? raw.date : "",
    numberOfTickets: toNumber(raw.numberOfTickets) ?? 0,
    pricePerTicket: toNumber(raw.pricePerTicket) ?? 0,
    awardName: typeof raw.awardName === "string" ? raw.awardName : "",
    awardDescription:
      typeof raw.awardDescription === "string" ? raw.awardDescription : "",
    awardImage: typeof raw.awardImage === "string" ? raw.awardImage : "",
    ticketWinner: typeof raw.ticketWinner === "string" ? raw.ticketWinner : "",
    ticketsLeft,
  };
}
