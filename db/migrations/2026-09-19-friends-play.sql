-- Friends play — casual 8-Ball games and friend tournaments (1v1 / 2v2).
--
-- Separate from the venue's official `tournaments` / `matches` (staff-run,
-- ranked): friends create these themselves, report their own results, and earn
-- "Friends League" points that never touch the official ranking, loyalty or
-- campaign XP.
--
-- One model serves both: a casual game and a tournament match are both a row in
-- friend_games; a 1v1 entrant is a team of one. Purely additive and idempotent —
-- safe to run on the live database BEFORE deploying the new code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-19-friends-play.sql

CREATE TABLE IF NOT EXISTS friend_tournaments (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  organizer_id     TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  format           TEXT NOT NULL CHECK (format IN ('1v1','2v2')),
  players_per_team INT  NOT NULL CHECK (players_per_team > 0),
  capacity_teams   INT  NOT NULL CHECK (capacity_teams BETWEEN 2 AND 64),
  seeding          TEXT NOT NULL DEFAULT 'random' CHECK (seeding IN ('random','ranking')),
  status           TEXT NOT NULL DEFAULT 'registration_open'
                   CHECK (status IN ('registration_open','in_progress','completed','cancelled')),
  champion_team_id TEXT,
  roster_key       TEXT,                       -- sorted player ids, set at start
  points_eligible  BOOLEAN NOT NULL DEFAULT false,
  version          INT  NOT NULL DEFAULT 1,    -- bumped on every change; clients ignore stale reads
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS friend_tournaments_org_idx ON friend_tournaments (organizer_id);

CREATE TABLE IF NOT EXISTS friend_games (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  organizer_id            TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  format                  TEXT NOT NULL CHECK (format IN ('1v1','2v2')),
  players_per_team        INT  NOT NULL CHECK (players_per_team > 0),
  status                  TEXT NOT NULL DEFAULT 'waiting_for_players'
                          CHECK (status IN ('waiting_for_players','ready','in_progress','completed','cancelled')),
  -- bracket position (null for a casual game)
  tournament_id           TEXT REFERENCES friend_tournaments(id) ON DELETE CASCADE,
  round                   INT,
  position                INT,
  next_game_id            TEXT REFERENCES friend_games(id) DEFERRABLE INITIALLY DEFERRED,
  next_slot               TEXT CHECK (next_slot IN ('a','b')),
  is_bye                  BOOLEAN NOT NULL DEFAULT false,
  -- sides (FKs to friend_teams are added below — the tables reference each other)
  team_a_id               TEXT,
  team_b_id               TEXT,
  winner_team_id          TEXT,
  -- result flow: one side reports, the other confirms
  result_status           TEXT NOT NULL DEFAULT 'none' CHECK (result_status IN ('none','reported','disputed')),
  reported_winner_team_id TEXT,
  reported_by             TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
  roster_key              TEXT,
  points_awarded          BOOLEAN NOT NULL DEFAULT false,
  version                 INT  NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS friend_games_org_idx ON friend_games (organizer_id);
CREATE INDEX IF NOT EXISTS friend_games_tournament_idx ON friend_games (tournament_id, round, position);
CREATE UNIQUE INDEX IF NOT EXISTS friend_games_slot_uq
  ON friend_games (tournament_id, round, position) WHERE tournament_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS friend_teams (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES friend_tournaments(id) ON DELETE CASCADE,
  game_id       TEXT REFERENCES friend_games(id) ON DELETE CASCADE,
  slot          TEXT CHECK (slot IN ('a','b')),   -- casual games only
  seed          INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (num_nonnulls(tournament_id, game_id) = 1)
);
CREATE INDEX IF NOT EXISTS friend_teams_tournament_idx ON friend_teams (tournament_id);
CREATE INDEX IF NOT EXISTS friend_teams_game_idx ON friend_teams (game_id);

DO $$ BEGIN
  ALTER TABLE friend_games
    ADD CONSTRAINT friend_games_team_a_fk FOREIGN KEY (team_a_id) REFERENCES friend_teams(id) ON DELETE SET NULL,
    ADD CONSTRAINT friend_games_team_b_fk FOREIGN KEY (team_b_id) REFERENCES friend_teams(id) ON DELETE SET NULL,
    ADD CONSTRAINT friend_games_winner_fk FOREIGN KEY (winner_team_id) REFERENCES friend_teams(id) ON DELETE SET NULL,
    ADD CONSTRAINT friend_games_reported_fk FOREIGN KEY (reported_winner_team_id) REFERENCES friend_teams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A member row is BOTH the participation and the invitation: status 'invited'
-- until the player accepts. Declining or being removed deletes the row.
CREATE TABLE IF NOT EXISTS friend_team_members (
  team_id       TEXT NOT NULL REFERENCES friend_teams(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  tournament_id TEXT REFERENCES friend_tournaments(id) ON DELETE CASCADE,  -- denormalised for the unique index
  game_id       TEXT REFERENCES friend_games(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted')),
  invited_by    TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  responded_at  TIMESTAMPTZ,
  PRIMARY KEY (team_id, player_id)
);
-- a player can only be on one team per tournament / per casual game
CREATE UNIQUE INDEX IF NOT EXISTS friend_members_tournament_uq
  ON friend_team_members (tournament_id, player_id) WHERE tournament_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS friend_members_game_uq
  ON friend_team_members (game_id, player_id) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS friend_members_player_idx ON friend_team_members (player_id, status);

CREATE TABLE IF NOT EXISTS friend_notifications (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  message    TEXT NOT NULL,
  href       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS friend_notifications_player_idx
  ON friend_notifications (player_id, created_at DESC);

-- Friends League points ledger. A player's total is SUM(points).
CREATE TABLE IF NOT EXISTS friend_points (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  game_id       TEXT REFERENCES friend_games(id) ON DELETE CASCADE,
  tournament_id TEXT REFERENCES friend_tournaments(id) ON DELETE CASCADE,
  points        INT  NOT NULL,
  reason        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS friend_points_player_idx ON friend_points (player_id, created_at DESC);
