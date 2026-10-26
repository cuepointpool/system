-- Accounting rebuild: one ledger for every rupee that moves through the
-- cash box or the bank, investor ownership shares, and per-investor edit
-- access. Replaces the old capital/expense finance module (its tables are
-- left in place but no longer read). Safe to run on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-26-accounting.sql
--   (then, as postgres: ALTER TABLE acct_entries OWNER TO cuepoint;
--                       ALTER TABLE acct_entry_log OWNER TO cuepoint;)
--
-- New installs get this from db/schema.sql.

ALTER TABLE business_partners
  ADD COLUMN IF NOT EXISTS share_pct         INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_edit_accounts BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE business_partners
    ADD CONSTRAINT business_partners_share_pct_range
    CHECK (share_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Treasurers could edit the old finance module; keep that access.
UPDATE business_partners
   SET can_edit_accounts = TRUE
 WHERE 'treasurer' = ANY(positions) AND NOT can_edit_accounts;

-- Every money movement. `cash` and `bank` are positive rupee amounts; the
-- kind decides the direction:
--   opening, income, capital  → cash +, bank +
--   expense, drawing          → cash −, bank −
--   deposit    (cash → bank)  → cash −, bank +   (cash = bank = amount)
--   withdrawal (bank → cash)  → cash +, bank −   (cash = bank = amount)
CREATE TABLE IF NOT EXISTS acct_entries (
  id            TEXT PRIMARY KEY,
  date          DATE NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN
                  ('opening','income','expense','deposit','withdrawal','capital','drawing')),
  category      TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  table_id      TEXT,
  table_name    TEXT,
  start_time    TEXT,
  end_time      TEXT,
  minutes       INT,
  partner_id    TEXT REFERENCES business_partners(id) ON DELETE SET NULL,
  cash          BIGINT NOT NULL DEFAULT 0 CHECK (cash >= 0),
  bank          BIGINT NOT NULL DEFAULT 0 CHECK (bank >= 0),
  receipt_image TEXT,
  created_by    TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acct_entries_date_idx ON acct_entries (date);

-- Who changed what: every add, edit and delete of an entry, with the row
-- before and after. Shown to admins only.
CREATE TABLE IF NOT EXISTS acct_entry_log (
  id         BIGSERIAL PRIMARY KEY,
  entry_id   TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('create','edit','delete')),
  actor      TEXT NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  before     JSONB,
  after      JSONB
);
CREATE INDEX IF NOT EXISTS acct_entry_log_at_idx ON acct_entry_log (at DESC);
