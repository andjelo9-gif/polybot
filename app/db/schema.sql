CREATE TABLE IF NOT EXISTS wallets (
  address    TEXT PRIMARY KEY,
  label      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals (
  id             SERIAL PRIMARY KEY,
  condition_id   TEXT NOT NULL,
  outcome_index  INT  NOT NULL,
  side           TEXT NOT NULL,
  outcome_name   TEXT,
  title          TEXT,
  event_slug     TEXT,
  avg_price      DOUBLE PRECISION,
  first_trade_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'pending',
  resolved_at    TIMESTAMPTZ,
  UNIQUE (condition_id, outcome_index, side)
);

CREATE TABLE IF NOT EXISTS signal_wallets (
  signal_id  INT  NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  wallet     TEXT NOT NULL,
  price      DOUBLE PRECISION,
  usdc_size  DOUBLE PRECISION,
  traded_at  TIMESTAMPTZ,
  PRIMARY KEY (signal_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_signals_status ON signals (status);
CREATE INDEX IF NOT EXISTS idx_signal_wallets_wallet ON signal_wallets (wallet);
