import { sql } from "@/lib/db";
import { trackerAuthorized, unauthorized } from "@/lib/tracker-auth";

export async function GET(request: Request) {
  if (!trackerAuthorized(request)) return unauthorized();
  const rows = (await sql`
    SELECT address FROM wallets WHERE active ORDER BY added_at
  `) as { address: string }[];
  return Response.json({ wallets: rows.map((r) => r.address) });
}
