export function decimalOdds(price: number | null): string {
  if (!price || price <= 0) return "—";
  return (1 / price).toFixed(2);
}

export function lisbonTime(ts: string | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** Flat-stake profit for one wallet entry in a resolved signal.
 *  A SELL at price p is treated as buying the opposite outcome at 1-p. */
export function flatStakeProfit(
  side: string,
  price: number | null,
  status: string,
  stake = 100,
): number {
  if (status !== "won" && status !== "lost") return 0;
  const p = side === "SELL" ? 1 - (price ?? 0) : (price ?? 0);
  if (p <= 0 || p >= 1) return 0;
  return status === "won" ? stake * (1 / p - 1) : -stake;
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}
