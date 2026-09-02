-- Partner logins + positions.
--
-- Each business partner can be given a username + password to sign in at
-- /partners, and one or more committee positions. A partner with the
-- 'treasurer' position may edit the finance module; every other signed-in
-- partner gets read-only access to it. Admin-only in the console otherwise.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-02-partner-logins.sql
--
-- New installs get this from db/schema.sql + scripts/setup.ts.

ALTER TABLE business_partners
  ADD COLUMN IF NOT EXISTS username      TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS positions     TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE business_partners
    ADD CONSTRAINT business_partners_username_key UNIQUE (username);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE business_partners
    ADD CONSTRAINT business_partners_positions_valid
    CHECK (positions <@ ARRAY['director','it_admin','secretary','marketing','treasurer']::text[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
