-- Daily play log — the counter's record of what was actually played.
--
-- Staff/admin enter each session by hand: table, start time, close time.
-- The system works out the minutes and the price. This is now the business's
-- table income: online bookings are reservations only and never count as
-- revenue (see lib/finance.ts).
--
-- Free time: every 3 paid hours a player earns 30 free minutes
-- (lib/playtime.ts). `free_min` records free minutes spent on a session.
--
-- Safe on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-15-play-logs.sql

CREATE TABLE IF NOT EXISTS play_logs (
  id            TEXT PRIMARY KEY,
  date          DATE NOT NULL,                 -- business day (a 1 AM finish belongs to the day before)
  table_id      TEXT NOT NULL,                 -- venue_tables.id
  table_name    TEXT NOT NULL,                 -- label snapshot
  start_time    TEXT NOT NULL,                 -- 'HH:MM'
  end_time      TEXT NOT NULL,                 -- 'HH:MM' (may be past midnight)
  played_min    INT  NOT NULL CHECK (played_min > 0),
  billed_min    INT  NOT NULL CHECK (billed_min > 0),   -- rounded up to 30-min blocks
  free_min      INT  NOT NULL DEFAULT 0 CHECK (free_min >= 0 AND free_min % 30 = 0 AND free_min <= billed_min),
  discount      INT  NOT NULL DEFAULT 0 CHECK (discount >= 0),
  amount        INT  NOT NULL CHECK (amount >= 0),       -- what was charged
  player_id     TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  booking_id    TEXT REFERENCES bookings(id) ON DELETE SET NULL,  -- the online reservation this fulfils, if any
  notes         TEXT,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS play_logs_date_idx ON play_logs (date);
CREATE INDEX IF NOT EXISTS play_logs_player_idx ON play_logs (player_id);
CREATE UNIQUE INDEX IF NOT EXISTS play_logs_booking_uq ON play_logs (booking_id) WHERE booking_id IS NOT NULL;
