import { sql, type Wallet } from "@/lib/db";
import { addWallet, removeWallet, toggleWallet } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default async function WalletsPage() {
  const wallets = (await sql`
    SELECT w.address, w.label, w.active, w.added_at,
           count(sw.signal_id)::int AS signal_count
    FROM wallets w
    LEFT JOIN signal_wallets sw ON sw.wallet = w.address
    GROUP BY w.address
    ORDER BY w.active DESC, w.added_at
  `) as Wallet[];

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-semibold">Tracked wallets</h1>

      <form action={addWallet} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="address" className="text-muted-foreground">
            Address
          </Label>
          <Input
            id="address"
            name="address"
            required
            pattern="0x[0-9a-fA-F]{40}"
            placeholder="0x…"
            className="w-96 font-mono text-xs"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="label" className="text-muted-foreground">
            Label (optional)
          </Label>
          <Input id="label" name="label" placeholder="nickname" className="w-40" />
        </div>
        <Button type="submit">Add wallet</Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Label</TableHead>
              <TableHead className={HEAD}>Address</TableHead>
              <TableHead className={HEAD}>Signals</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.map((w) => (
              <TableRow key={w.address}>
                <TableCell className="px-4">{w.label ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <a
                    href={`https://polymarket.com/profile/${w.address}`}
                    target="_blank"
                    className="hover:text-foreground hover:underline"
                  >
                    {w.address}
                  </a>
                </TableCell>
                <TableCell className="font-mono text-xs">{w.signal_count}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      w.active
                        ? "border-emerald-500/30 font-mono text-emerald-400 uppercase"
                        : "font-mono text-muted-foreground uppercase"
                    }
                  >
                    {w.active ? "active" : "paused"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2 pr-2">
                    <form action={toggleWallet}>
                      <input type="hidden" name="address" value={w.address} />
                      <Button variant="outline" size="sm">
                        {w.active ? "Pause" : "Resume"}
                      </Button>
                    </form>
                    <form action={removeWallet}>
                      <input type="hidden" name="address" value={w.address} />
                      <Button variant="destructive" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {wallets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No wallets yet — add one above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        The tracker polls active wallets every ~5 minutes. Removing a wallet
        that has signal history pauses it instead, so past stats stay intact.
      </p>
    </main>
  );
}
