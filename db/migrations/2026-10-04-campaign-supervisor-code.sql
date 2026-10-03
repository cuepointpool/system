-- Campaign Mode — supervised progress.
--
-- Players can no longer record their own mission progress. An admin watches
-- the game, then enters their personal pass code on the player's phone to
-- approve it. The code is stored hashed (scrypt), one per admin account, and
-- is set from the admin console (Campaign tab).
--
-- Purely additive and idempotent — safe to run on the live database BEFORE
-- deploying the new code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-04-campaign-supervisor-code.sql

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS supervisor_code_hash TEXT;
