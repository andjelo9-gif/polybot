import { sql, type Signal } from "@/lib/db";
import { decimalOdds, lisbonTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const BADGE: Record<Signal["status"], string> = {
  pending: "bg-zinc-800 text-zinc-300",
  won: "bg-emerald-950 text-emerald-400",
  lost: "bg-red-950 text-red-400",
  void: "bg-zinc-800 text-zinc-500",
};

export default async function SignalsPage() {
  const signals = (await sql`
    SELECT s.*, count(sw.wallet)::int AS wallet_count
    FROM signals s
    LEFT JOIN signal_wallets sw ON sw.signal_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 200
  `) as Signal[];

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Signals</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Bet</th>
              <th className="px-4 py-3 font-medium">Odds</th>
              <th className="px-4 py-3 font-medium">Wallets</th>
              <th className="px-4 py-3 font-medium">First trade</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id} className="border-t border-zinc-800/70">
                <td className="max-w-md px-4 py-3">
                  {s.event_slug ? (
                    <a
                      href={`https://polymarket.com/event/${s.event_slug}`}
                      target="_blank"
                      className="hover:underline"
                    >
                      {s.title ?? s.condition_id}
                    </a>
                  ) : (
                    (s.title ?? s.condition_id)
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {s.side} “{s.outcome_name ?? `#${s.outcome_index}`}”
                </td>
                <td className="px-4 py-3">{decimalOdds(s.avg_price)}</td>
                <td className="px-4 py-3">{s.wallet_count}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
                  {lisbonTime(s.first_trade_at)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${BADGE[s.status]}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {signals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No signals yet — they appear when enough tracked wallets place
                  the same bet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
