-- Per-table online-booking switch.
--
-- `bookable = FALSE` keeps a table visible in the public floor view (players
-- still see its live busy/free state) but blocks online reservations for it —
-- those tables are booked in person / by phone. Safe on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-02-table-bookable.sql

ALTER TABLE venue_tables
  ADD COLUMN IF NOT EXISTS bookable BOOLEAN NOT NULL DEFAULT TRUE;
