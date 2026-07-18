// One-time DB setup: applies db/schema.sql and seeds the wallets table from
// the tracker's hardcoded list, with labels from polymarket_sports_wallets.csv.
// Usage:  DATABASE_URL=postgres://…  node scripts/init-db.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// Wallet list: the TRACKED_WALLETS block in the python tracker.
const tracker = readFileSync(join(repoRoot, "polymarket_tracker.py"), "utf8");
const block = tracker.match(/TRACKED_WALLETS = \[([\s\S]*?)\]/)?.[1] ?? "";
const wallets = [...block.matchAll(/0x[0-9a-fA-F]{40}/g)].map((m) =>
  m[0].toLowerCase(),
);

// Labels: username column of the research CSV (handles quoted fields).
function parseCsvLine(line) {
  const out = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const labels = new Map();
try {
  const csv = readFileSync(join(repoRoot, "polymarket_sports_wallets.csv"), "utf8");
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const iUser = header.indexOf("username");
  const iWallet = header.indexOf("wallet");
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    if (cols[iWallet]) labels.set(cols[iWallet].toLowerCase(), cols[iUser]);
  }
} catch {
  console.warn("CSV not found - seeding without labels");
}

const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
await sql.unsafe(schema);
console.log("Schema applied.");

for (const w of wallets) {
  await sql`
    INSERT INTO wallets (address, label)
    VALUES (${w}, ${labels.get(w) ?? null})
    ON CONFLICT (address) DO NOTHING
  `;
}
console.log(`Seeded ${wallets.length} wallets.`);

const rows = await sql`SELECT address, label, active FROM wallets ORDER BY added_at`;
console.table(rows.map((r) => ({ ...r })));
await sql.end();
