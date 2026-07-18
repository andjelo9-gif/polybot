import { sql } from "@/lib/db";
import { flatStakeProfit, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = {
  wallet: string;
  label: string | null;
  active: boolean;
  side: string;
  price: number | null;
  status: string;
};

type WalletStats = {
  wallet: string;
  label: string | null;
  active: boolean;
  signals: number;
  wins: number;
  losses: number;
  profit: number;
};

export default async function LeaderboardPage() {
  const rows = (await sql`
    SELECT sw.wallet, w.label, coalesce(w.active, FALSE) AS active,
           s.side, sw.price, s.status
    FROM signal_wallets sw
    JOIN signals s ON s.id = sw.signal_id
    LEFT JOIN wallets w ON w.address = sw.wallet
  `) as Row[];

  const byWallet = new Map<string, WalletStats>();
  for (const r of rows) {
    let stats = byWallet.get(r.wallet);
    if (!stats) {
      stats = {
        wallet: r.wallet,
        label: r.label,
        active: r.active,
        signals: 0,
        wins: 0,
        losses: 0,
        profit: 0,
      };
      byWallet.set(r.wallet, stats);
    }
    stats.signals += 1;
    if (r.status === "won") stats.wins += 1;
    if (r.status === "lost") stats.losses += 1;
    stats.profit += flatStakeProfit(r.side, r.price, r.status);
  }

  const leaderboard = [...byWallet.values()].sort((a, b) => b.profit - a.profit);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Wallet leaderboard</h1>
      <p className="text-sm text-zinc-400">
        Hypothetical result of betting a flat $100 on every resolved signal the
        wallet participated in, at that wallet’s own entry price.
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Signals</th>
              <th className="px-4 py-3 font-medium">W–L</th>
              <th className="px-4 py-3 font-medium">Win %</th>
              <th className="px-4 py-3 font-medium">P/L ($100 flat)</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((s) => {
              const resolved = s.wins + s.losses;
              return (
                <tr key={s.wallet} className="border-t border-zinc-800/70">
                  <td className="px-4 py-3">
                    <a
                      href={`https://polymarket.com/profile/${s.wallet}`}
                      target="_blank"
                      className="hover:underline"
                    >
                      {s.label ?? `${s.wallet.slice(0, 10)}…`}
                    </a>
                    {!s.active && (
                      <span className="ml-2 text-xs text-zinc-500">(paused)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{s.signals}</td>
                  <td className="px-4 py-3">
                    {s.wins}–{s.losses}
                  </td>
                  <td className="px-4 py-3">
                    {resolved ? `${((100 * s.wins) / resolved).toFixed(0)}%` : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      s.profit > 0
                        ? "text-emerald-400"
                        : s.profit < 0
                          ? "text-red-400"
                          : ""
                    }`}
                  >
                    {money(s.profit)}
                  </td>
                </tr>
              );
            })}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No resolved signals yet — the leaderboard fills in as markets
                  settle.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
