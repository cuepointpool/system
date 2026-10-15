-- Cancelling a tournament needs a one-time code: the organizer (or staff)
-- asks for one, it is shown on screen, and they type it back. Only a hash is
-- stored, and it expires after 10 minutes. Purely additive — run BEFORE
-- deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-17-cancel-codes.sql

ALTER TABLE friend_tournaments
  ADD COLUMN IF NOT EXISTS cancel_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancel_code_expires TIMESTAMPTZ;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS cancel_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancel_code_expires TIMESTAMPTZ;
