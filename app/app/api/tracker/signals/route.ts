import { sql } from "@/lib/db";
import { trackerAuthorized, unauthorized } from "@/lib/tracker-auth";

type TradeIn = {
  wallet: string;
  price: number;
  usdc_size: number;
  timestamp: number;
};

export async function POST(request: Request) {
  if (!trackerAuthorized(request)) return unauthorized();
  const body = await request.json();

  const trades: TradeIn[] = body.trades ?? [];
  if (!body.condition_id || body.outcome_index == null || !body.side || !trades.length) {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }

  const avgPrice = trades.reduce((a, t) => a + t.price, 0) / trades.length;
  const firstTs = new Date(Math.min(...trades.map((t) => t.timestamp)) * 1000);

  const [signal] = (await sql`
    INSERT INTO signals (condition_id, outcome_index, side, outcome_name,
                         title, event_slug, avg_price, first_trade_at)
    VALUES (${body.condition_id}, ${body.outcome_index}, ${body.side},
            ${body.outcome_name ?? null}, ${body.title ?? null},
            ${body.event_slug ?? null}, ${avgPrice}, ${firstTs.toISOString()})
    ON CONFLICT (condition_id, outcome_index, side)
    DO UPDATE SET avg_price = EXCLUDED.avg_price
    RETURNING id
  `) as { id: number }[];

  for (const t of trades) {
    await sql`
      INSERT INTO signal_wallets (signal_id, wallet, price, usdc_size, traded_at)
      VALUES (${signal.id}, ${t.wallet.toLowerCase()}, ${t.price},
              ${t.usdc_size}, ${new Date(t.timestamp * 1000).toISOString()})
      ON CONFLICT (signal_id, wallet) DO NOTHING
    `;
  }

  return Response.json({ id: signal.id });
}
