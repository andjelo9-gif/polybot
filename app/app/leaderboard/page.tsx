import { sql } from "@/lib/db";
import { flatStakeProfit, money } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const HEAD = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

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
      <h1 className="text-xl font-semibold">Wallet leaderboard</h1>
      <p className="text-sm text-muted-foreground">
        Hypothetical result of betting a flat $100 on every resolved signal the
        wallet participated in, at that wallet’s own entry price.
      </p>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Wallet</TableHead>
              <TableHead className={HEAD}>Signals</TableHead>
              <TableHead className={HEAD}>W–L</TableHead>
              <TableHead className={HEAD}>Win %</TableHead>
              <TableHead className={HEAD}>P/L ($100 flat)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((s) => {
              const resolved = s.wins + s.losses;
              return (
                <TableRow key={s.wallet}>
                  <TableCell className="px-4">
                    <a
                      href={`https://polymarket.com/profile/${s.wallet}`}
                      target="_blank"
                      className="hover:underline"
                    >
                      {s.label ?? `${s.wallet.slice(0, 10)}…`}
                    </a>
                    {!s.active && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        (paused)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.signals}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.wins}–{s.losses}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {resolved ? `${((100 * s.wins) / resolved).toFixed(0)}%` : "—"}
                  </TableCell>
                  <TableCell
                    className={`font-mono text-xs font-medium ${
                      s.profit > 0
                        ? "text-emerald-400"
                        : s.profit < 0
                          ? "text-red-400"
                          : ""
                    }`}
                  >
                    {money(s.profit)}
                  </TableCell>
                </TableRow>
              );
            })}
            {leaderboard.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No resolved signals yet — the leaderboard fills in as markets
                  settle.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
