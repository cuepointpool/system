-- Player profile photos.
--
-- The image bytes live here (resized to a small square in the browser before
-- upload); player_profiles.avatar holds the URL that serves them,
-- /api/avatars/<player id>/<version>, so lists never carry image data and a
-- new photo gets a new URL (no stale CDN copies). Safe on a live database.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-15-player-avatars.sql

CREATE TABLE IF NOT EXISTS player_avatars (
  player_id  TEXT PRIMARY KEY REFERENCES player_profiles(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  data       BYTEA NOT NULL,
  version    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
