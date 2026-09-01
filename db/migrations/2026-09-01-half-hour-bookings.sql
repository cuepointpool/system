-- Half-hour bookings: sessions and start times now move on a 30-minute grid,
-- so duration_hrs must hold 0.5 steps. Safe to run on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-01-half-hour-bookings.sql
--
-- New installs get this from db/schema.sql directly (npm run db:setup).

ALTER TABLE bookings
  ALTER COLUMN duration_hrs TYPE NUMERIC(3,1);
