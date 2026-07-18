import { sql } from "@/lib/db";
import { trackerAuthorized, unauthorized } from "@/lib/tracker-auth";

export async function GET(request: Request) {
  if (!trackerAuthorized(request)) return unauthorized();
  const rows = await sql`
    SELECT id, condition_id, outcome_index, side
    FROM signals WHERE status = 'pending'
    ORDER BY id
  `;
  return Response.json({ signals: rows });
}
