-- Partner clubs (first one: Infinity Pool Club).
--
-- A club has its own admin sign-in (username + password, made by a Cue Point
-- admin), its own members (ordinary Cue Point player accounts) split into
-- ranked groups (group 1 = the top / "Pro" group), and runs a weekly league
-- in every group. After a week the bottom players of each group move down
-- and the top players of the group below move up.
--
-- Each club has a hidden "host" profile (role 'club', no email, no password)
-- that is the organizer of its tournaments, so club leagues run on the same
-- engine as friend / official tournaments. role 'club' never appears on any
-- leaderboard or player list (those all filter role = 'player').
--
-- Purely additive and safe to re-run. Run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-06-clubs.sql
--
-- then (prod) give the new tables to the app role:
--   ALTER TABLE clubs OWNER TO cuepoint; ALTER TABLE club_members OWNER TO cuepoint;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'club';

CREATE TABLE IF NOT EXISTS clubs (
  id               TEXT PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  -- organizer of the club's tournaments (a player_profiles row with role 'club')
  host_id          TEXT NOT NULL UNIQUE REFERENCES player_profiles(id),
  username         TEXT UNIQUE,
  password_hash    TEXT,
  session_version  INT  NOT NULL DEFAULT 0,      -- bumped on password change
  active           BOOLEAN NOT NULL DEFAULT true,
  group_count      INT  NOT NULL DEFAULT 2 CHECK (group_count BETWEEN 1 AND 12),
  group_names      JSONB NOT NULL DEFAULT '[]',  -- index 0 = group 1 (top)
  -- players moving up / down between two neighbouring groups each week;
  -- NULL = half of the smaller group
  move_count       INT CHECK (move_count IS NULL OR move_count BETWEEN 0 AND 50),
  league_settings  JSONB NOT NULL DEFAULT '{}',  -- league options for every group
  -- the last week whose results were turned into group moves (0 = none)
  moves_applied_week INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_members (
  club_id    TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  group_no   INT  NOT NULL CHECK (group_no BETWEEN 1 AND 12),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, player_id)
);
CREATE INDEX IF NOT EXISTS club_members_player_idx ON club_members (player_id);

-- a club week = one league tournament per group
ALTER TABLE friend_tournaments
  ADD COLUMN IF NOT EXISTS club_id    TEXT REFERENCES clubs(id),
  ADD COLUMN IF NOT EXISTS club_week  INT,
  ADD COLUMN IF NOT EXISTS club_group INT;
CREATE INDEX IF NOT EXISTS friend_tournaments_club_idx
  ON friend_tournaments (club_id, club_week) WHERE club_id IS NOT NULL;
