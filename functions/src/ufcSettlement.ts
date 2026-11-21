export type UfcSide = "A" | "B";
export type UfcMethod = "KO_TKO" | "SUBMISSION" | "DECISION";
export type UfcPick = { side: UfcSide; method?: UfcMethod };
export type UfcRules = { version: 1; methodPriceCents: number };

/** Normalize technical draws to DRAW; no contest, cancellation, or replacement to VOID. */
export type UfcOfficialResult =
  | { kind: "WINNER"; side: UfcSide; method: UfcMethod | "TECHNICAL_DECISION" | "TECHNICAL_SUBMISSION" | "DQ" }
  | { kind: "DRAW" }
  | { kind: "VOID" };

export type UfcEntry<Pick extends UfcPick> = {
  id: string;
  pick: Pick;
  quantity: number;
};

export type UfcSettlementInput = {
  ufcRules: UfcRules;
  basePriceCents: number;
  /** Frozen market fee in whole basis points (1000 = 10%). No default. */
  frozenFeeBps: number;
  /** Include only verified stakes. IDs identify entries within each pool. */
  baseEntries: readonly UfcEntry<UfcPick & { method?: never }>[];
  methodEntries: readonly UfcEntry<Required<UfcPick>>[];
  result: UfcOfficialResult;
};

export type UfcObligation = {
  id: string;
  kind: "PAYOUT" | "REFUND" | "LOSS";
  /** Gross amount owed for this entry, not a confirmed transfer. */
  amountCents: number;
};

type ForcedRefund = "REFUND_DRAW" | "REFUND_VOID";

export type UfcPoolSettlement = {
  status: "SETTLED" | ForcedRefund | "REFUND_NO_WINNER";
  stakeCents: number;
  feeCents: number;
  breakageCents: number;
  owedCents: number;
  obligations: UfcObligation[];
};

export type UfcSettlement = { base: UfcPoolSettlement; method: UfcPoolSettlement };

const BASIS_POINTS = BigInt(10000);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSide(value: unknown): value is UfcSide {
  return value === "A" || value === "B";
}

function isMethod(value: unknown): value is UfcMethod {
  return value === "KO_TKO" || value === "SUBMISSION" || value === "DECISION";
}

function settlePool<P extends UfcPick>(
  pool: "base" | "method",
  entries: readonly UfcEntry<P>[],
  priceCents: number,
  frozenFeeBps: number,
  grade: ForcedRefund | ((pick: P) => boolean),
): UfcPoolSettlement {
  let stakeCents = 0;
  let winningTickets = 0;
  const ids = new Set<string>();
  for (const { id, pick, quantity } of entries) {
    if (typeof id !== "string" || id.trim() === "" || ids.has(id)) {
      throw new TypeError(`Invalid or duplicate ${pool} entry id`);
    }
    ids.add(id);
    if (!isSide(pick?.side) || (pool === "base" ? pick.method !== undefined : !isMethod(pick.method))) {
      throw new TypeError(`Invalid ${pool} pick`);
    }
    if (!isPositiveInteger(quantity)) throw new RangeError(`Invalid ${pool} quantity`);
    stakeCents += quantity * priceCents;
    if (!Number.isSafeInteger(stakeCents)) throw new RangeError(`Unsafe ${pool} pool stake`);
    if (typeof grade === "function" && grade(pick)) winningTickets += quantity;
  }

  if (typeof grade !== "function" || winningTickets === 0) {
    return {
      status: typeof grade === "function" ? "REFUND_NO_WINNER" : grade,
      stakeCents,
      feeCents: 0,
      breakageCents: 0,
      owedCents: stakeCents,
      obligations: entries.map(({ id, quantity }) => ({ id, kind: "REFUND", amountCents: quantity * priceCents })),
    };
  }

  // Match legacy policy: floor net pool, then floor the gross return per ticket.
  const net = BigInt(stakeCents) * (BASIS_POINTS - BigInt(frozenFeeBps)) / BASIS_POINTS;
  const perTicket = Number(net / BigInt(winningTickets));
  const owedCents = perTicket * winningTickets;
  return {
    status: "SETTLED",
    stakeCents,
    feeCents: stakeCents - Number(net),
    breakageCents: Number(net) - owedCents,
    owedCents,
    obligations: entries.map(({ id, pick, quantity }) => grade(pick)
      ? { id, kind: "PAYOUT", amountCents: perTicket * quantity }
      : { id, kind: "LOSS", amountCents: 0 }),
  };
}

/** Compute obligations for one UFC v1 market without writing or moving money. */
export function settleUfcMarket(input: UfcSettlementInput): UfcSettlement {
  const { ufcRules, basePriceCents, frozenFeeBps, baseEntries, methodEntries, result } = input;
  if (ufcRules?.version !== 1) throw new TypeError("Expected ufcRules version 1");
  if (!isPositiveInteger(ufcRules.methodPriceCents)) throw new RangeError("Invalid methodPriceCents");
  if (!isPositiveInteger(basePriceCents)) throw new RangeError("Invalid basePriceCents");
  if (!Number.isSafeInteger(frozenFeeBps) || frozenFeeBps < 0 || frozenFeeBps >= 10000) {
    throw new RangeError("Invalid frozenFeeBps");
  }

  if (result.kind !== "WINNER") {
    if (result.kind !== "DRAW" && result.kind !== "VOID") throw new TypeError("Invalid official result");
    const refund = result.kind === "DRAW" ? "REFUND_DRAW" : "REFUND_VOID";
    return {
      base: settlePool("base", baseEntries, basePriceCents, frozenFeeBps, refund),
      method: settlePool("method", methodEntries, ufcRules.methodPriceCents, frozenFeeBps, refund),
    };
  }

  const method = result.method === "TECHNICAL_DECISION" ? "DECISION"
    : result.method === "TECHNICAL_SUBMISSION" ? "SUBMISSION" : result.method;
  if (!isSide(result.side) || (method !== "DQ" && !isMethod(method))) throw new TypeError("Invalid official result");
  return {
    base: settlePool("base", baseEntries, basePriceCents, frozenFeeBps, (pick) => pick.side === result.side),
    method: settlePool("method", methodEntries, ufcRules.methodPriceCents, frozenFeeBps,
      method === "DQ" ? "REFUND_VOID" : (pick) => pick.side === result.side && pick.method === method),
  };
}
