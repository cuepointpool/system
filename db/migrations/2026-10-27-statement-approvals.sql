-- Signed balance sheets. Each investor keeps a transparent signature
-- image; the treasurer submits a month's balance sheet for review, every
-- investor approves it (their signature is stamped on), then anyone can
-- download the signed PDF. Reviews are short-lived: finished ones are
-- deleted after 7 days, anything older than 30 days regardless.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-27-statement-approvals.sql
--   (then, as postgres: ALTER TABLE statement_reviews OWNER TO cuepoint;
--                       ALTER TABLE statement_approvals OWNER TO cuepoint;)

ALTER TABLE business_partners
  ADD COLUMN IF NOT EXISTS signature_image TEXT;   -- PNG data URL, transparent

CREATE TABLE IF NOT EXISTS statement_reviews (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL DEFAULT 'balance_sheet',
  month         TEXT NOT NULL,                 -- 'YYYY-MM'
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,                 -- the "as at" date
  tax_rate      NUMERIC NOT NULL DEFAULT 0,
  snapshot      JSONB NOT NULL,                -- report figures frozen at submit
  investors     JSONB NOT NULL,                -- [{id,name,sharePct}] who must approve
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  submitted_by  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS statement_reviews_created_idx ON statement_reviews (created_at DESC);

CREATE TABLE IF NOT EXISTS statement_approvals (
  review_id   TEXT NOT NULL REFERENCES statement_reviews(id) ON DELETE CASCADE,
  partner_id  TEXT NOT NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  note        TEXT NOT NULL DEFAULT '',
  signature   TEXT,                            -- copy of the signature used
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, partner_id)
);
