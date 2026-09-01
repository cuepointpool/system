-- Business finance module: partners + capital, expenses with receipts, and the
-- daily cash drawer. Admin-only in the console. Safe to run on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-01-business-finance.sql
--
-- New installs get this from db/schema.sql + scripts/setup.ts (npm run db:setup).

CREATE TABLE IF NOT EXISTS business_partners (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capital_contributions (
  id         TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES business_partners(id) ON DELETE CASCADE,
  amount     BIGINT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  at         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capital_contributions_partner_idx
  ON capital_contributions (partner_id);

CREATE TABLE IF NOT EXISTS business_expenses (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  amount        BIGINT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'revenue',
  spent_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_image TEXT,
  created_by    TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_expenses_date_idx
  ON business_expenses (spent_at);

CREATE TABLE IF NOT EXISTS cash_days (
  date           DATE PRIMARY KEY,
  opening_amount BIGINT,
  opening_type   TEXT NOT NULL DEFAULT '',
  opening_note   TEXT NOT NULL DEFAULT '',
  opened_by      TEXT,
  opened_at      TIMESTAMPTZ,
  closing_amount BIGINT,
  closing_type   TEXT NOT NULL DEFAULT '',
  closing_note   TEXT NOT NULL DEFAULT '',
  closed_by      TEXT,
  closed_at      TIMESTAMPTZ
);

-- Seed the four partner slots once (rename them in the console).
INSERT INTO business_partners (id, name, sort_order)
SELECT 'bp_' || g, 'Partner ' || g, g - 1
FROM generate_series(1, 4) AS g
WHERE NOT EXISTS (SELECT 1 FROM business_partners);
