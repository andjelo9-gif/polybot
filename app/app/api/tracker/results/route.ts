import { sql } from "@/lib/db";
import { trackerAuthorized, unauthorized } from "@/lib/tracker-auth";

const VALID = new Set(["won", "lost", "void"]);

export async function POST(request: Request) {
  if (!trackerAuthorized(request)) return unauthorized();
  const body = await request.json();
  const results: { id: number; status: string }[] = body.results ?? [];

  let updated = 0;
  for (const r of results) {
    if (!VALID.has(r.status)) continue;
    await sql`
      UPDATE signals SET status = ${r.status}, resolved_at = now()
      WHERE id = ${r.id} AND status = 'pending'
    `;
    updated += 1;
  }
  return Response.json({ updated });
}
