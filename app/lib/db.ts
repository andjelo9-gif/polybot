import postgres from "postgres";

type SqlTag = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<any[]>;

// Lazy so the module can be imported without DATABASE_URL (e.g. at build time).
// prepare:false is required for Supabase's transaction-mode pooler.
let cached: SqlTag | null = null;
export const sql: SqlTag = (strings, ...params) => {
  cached ??= postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
  }) as unknown as SqlTag;
  return cached(strings, ...params);
};

export type Wallet = {
  address: string;
  label: string | null;
  active: boolean;
  added_at: string;
  signal_count: number;
};

export type Signal = {
  id: number;
  condition_id: string;
  outcome_index: number;
  side: string;
  outcome_name: string | null;
  title: string | null;
  event_slug: string | null;
  avg_price: number | null;
  first_trade_at: string | null;
  created_at: string;
  status: "pending" | "won" | "lost" | "void";
  resolved_at: string | null;
  wallet_count: number;
};
