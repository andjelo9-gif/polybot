import { sql, type Signal } from "@/lib/db";
import { decimalOdds, lisbonTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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

const BADGE: Record<Signal["status"], string> = {
  pending: "text-muted-foreground",
  won: "border-emerald-500/30 text-emerald-400",
  lost: "border-red-500/30 text-red-400",
  void: "text-muted-foreground/60",
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
      <h1 className="text-xl font-semibold">Signals</h1>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Market</TableHead>
              <TableHead className={HEAD}>Bet</TableHead>
              <TableHead className={HEAD}>Odds</TableHead>
              <TableHead className={HEAD}>Wallets</TableHead>
              <TableHead className={HEAD}>First trade</TableHead>
              <TableHead className={HEAD}>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="max-w-md truncate px-4">
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
                </TableCell>
                <TableCell>
                  {s.side} “{s.outcome_name ?? `#${s.outcome_index}`}”
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {decimalOdds(s.avg_price)}
                </TableCell>
                <TableCell className="font-mono text-xs">{s.wallet_count}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {lisbonTime(s.first_trade_at)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-mono uppercase ${BADGE[s.status]}`}>
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {signals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No signals yet — they appear when enough tracked wallets place
                  the same bet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
