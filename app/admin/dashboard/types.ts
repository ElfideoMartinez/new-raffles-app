type Counts = { confirmed: number; pending: number; limited: boolean };
type SaleLatest = { createdAt: number | null; status: "verified" | "unverified"; amount: number | null };
type QuickLatest = { createdAt: number | null; status: "active" | "finnished" | "pending" | "unknown" };
type PaidCounts = Counts & { amount: number; latest: SaleLatest | null };

export type DashboardStats = { raffles: PaidCounts; bets: PaidCounts; quick: Counts & { latest: QuickLatest | null } };

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isDashboardStats(value: unknown): value is DashboardStats {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (["raffles", "bets", "quick"] as const).every((key) => {
    const value = record[key];
    if (!value || typeof value !== "object") return false;
    const { confirmed, pending, amount, limited, latest } = value as Record<string, unknown>;
    if (typeof confirmed !== "number" || !Number.isSafeInteger(confirmed) || confirmed < 0 ||
      typeof pending !== "number" || !Number.isSafeInteger(pending) || pending < 0 ||
      typeof limited !== "boolean" || (key !== "quick" && !isAmount(amount))) return false;
    if (latest === null) return true;
    if (!latest || typeof latest !== "object") return false;
    const { createdAt, status, amount: latestAmount } = latest as Record<string, unknown>;
    if (createdAt !== null && (!isAmount(createdAt) || !Number.isSafeInteger(createdAt) || createdAt > 8.64e15)) return false;
    return key === "quick"
      ? status === "active" || status === "finnished" || status === "pending" || status === "unknown"
      : (status === "verified" || status === "unverified") && (latestAmount === null || isAmount(latestAmount));
  });
}
