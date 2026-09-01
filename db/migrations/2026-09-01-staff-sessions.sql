-- Staff/admin table assignment + walk-in sessions.
-- Adds booking origin, payment state and check-in/out timestamps so the
-- console can seat walk-ins, close sessions on departure and take payment.
-- Safe to run on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-01-staff-sessions.sql
--
-- New installs get this from db/schema.sql (npm run db:setup).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS origin         TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_open_session_idx
  ON bookings (checked_in_at) WHERE checked_out_at IS NULL;
