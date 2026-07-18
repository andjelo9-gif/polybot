import { sql, type Wallet } from "@/lib/db";
import { addWallet, removeWallet, toggleWallet } from "./actions";

export const dynamic = "force-dynamic";

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
      <h1 className="text-2xl font-semibold">Tracked wallets</h1>

      <form action={addWallet} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Address
          <input
            name="address"
            required
            pattern="0x[0-9a-fA-F]{40}"
            placeholder="0x…"
            className="w-96 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Label (optional)
          <input
            name="label"
            placeholder="nickname"
            className="w-40 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Add wallet
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Signals</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.address} className="border-t border-zinc-800/70">
                <td className="px-4 py-3">{w.label ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <a
                    href={`https://polymarket.com/profile/${w.address}`}
                    target="_blank"
                    className="hover:underline"
                  >
                    {w.address}
                  </a>
                </td>
                <td className="px-4 py-3">{w.signal_count}</td>
                <td className="px-4 py-3">
                  <span className={w.active ? "text-emerald-400" : "text-zinc-500"}>
                    {w.active ? "active" : "paused"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <form action={toggleWallet}>
                      <input type="hidden" name="address" value={w.address} />
                      <button className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                        {w.active ? "Pause" : "Resume"}
                      </button>
                    </form>
                    <form action={removeWallet}>
                      <input type="hidden" name="address" value={w.address} />
                      <button className="rounded-md border border-red-900/60 px-3 py-1 text-xs text-red-400 hover:bg-red-950/40">
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {wallets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No wallets yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        The tracker polls active wallets every ~30 minutes. Removing a wallet
        that has signal history pauses it instead, so past stats stay intact.
      </p>
    </main>
  );
}
