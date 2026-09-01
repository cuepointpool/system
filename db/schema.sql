-- ===========================================================================
-- Cue Point — full database schema (PostgreSQL, raw SQL, no ORM)
--
-- Idempotent reset: drops and recreates the `public` schema.
--   npm run db:setup        apply this file + insert business config
--                           (membership tiers, achievements, rewards, the venue)
--
-- No demo/activity data is inserted. Players, matches, tournaments, promotions
-- and everything else are created through the app (sign-up + the staff console).
-- The FIRST account to register becomes the admin.
-- ===========================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ------------------------------------------------------------------ enums ---

CREATE TYPE skill_level     AS ENUM ('Rookie','Amateur','Intermediate','Advanced','Pro');
CREATE TYPE user_role       AS ENUM ('player','staff','admin');
CREATE TYPE match_type      AS ENUM ('casual','ranked','tournament');
CREATE TYPE membership_tier AS ENUM ('basic','pro','elite');
CREATE TYPE membership_status AS ENUM ('active','expired','none');
CREATE TYPE booking_status  AS ENUM ('PENDING','CONFIRMED','CANCELLED');
CREATE TYPE tournament_format AS ENUM ('single_elim','double_elim','round_robin','league');
CREATE TYPE tournament_status AS ENUM
  ('registration_open','registration_closed','upcoming','live','completed','cancelled');
CREATE TYPE loyalty_source  AS ENUM
  ('booking','match','ranked_win','tournament','referral','promotion','membership','manual','redemption');

-- --------------------------------------------------------------- bookings ---

-- Physical tables on the floor, managed from the admin console.
CREATE TABLE venue_tables (
  id         TEXT PRIMARY KEY,          -- e.g. 'table-1'
  label      TEXT NOT NULL,             -- display name, e.g. 'Table 1'
  area       TEXT NOT NULL DEFAULT 'Main floor',
  note       TEXT NOT NULL DEFAULT '',
  seats      INT  NOT NULL DEFAULT 4,
  sort_order INT  NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX venue_tables_order_idx ON venue_tables (sort_order);

CREATE TABLE bookings (
  id             TEXT PRIMARY KEY,
  reference      TEXT UNIQUE NOT NULL,
  table_id       TEXT NOT NULL,          -- venue_tables.id
  table_name     TEXT NOT NULL,          -- label snapshot, e.g. 'Table 1'
  customer_name  TEXT NOT NULL,
  phone          TEXT NOT NULL,          -- '' allowed for staff-entered walk-ins
  email          TEXT,
  date           DATE NOT NULL,
  start_time     TEXT NOT NULL,
  duration_hrs   NUMERIC(3,1) NOT NULL,  -- 0.5-hour granularity
  party_size     INT  NOT NULL,
  total_amount   INT  NOT NULL,
  status         booking_status NOT NULL DEFAULT 'CONFIRMED',
  notes          TEXT,
  player_id      TEXT,
  origin         TEXT NOT NULL DEFAULT 'online',   -- online | walk_in | staff
  payment_status TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid | paid
  checked_in_at  TIMESTAMPTZ,                       -- walk-in session: actually seated
  checked_out_at TIMESTAMPTZ,                       -- session closed & billed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bookings_date_table_idx ON bookings (date, table_id);
CREATE INDEX bookings_open_session_idx ON bookings (checked_in_at) WHERE checked_out_at IS NULL;

-- --------------------------------------------------------- business finance ---
-- Owner-facing bookkeeping: the partners and their capital, business expenses
-- (with receipt images), and the daily cash drawer. Admin-only in the console.

CREATE TABLE business_partners (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE capital_contributions (
  id         TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES business_partners(id) ON DELETE CASCADE,
  amount     BIGINT NOT NULL,                 -- LKR, whole rupees
  note       TEXT NOT NULL DEFAULT '',
  at         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX capital_contributions_partner_idx ON capital_contributions (partner_id);

CREATE TABLE business_expenses (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  amount        BIGINT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'revenue',   -- 'capital' | 'revenue'
  spent_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_image TEXT,                               -- base64 data URL, nullable
  created_by    TEXT NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX business_expenses_date_idx ON business_expenses (spent_at);

CREATE TABLE cash_days (
  date           DATE PRIMARY KEY,
  opening_amount BIGINT,
  opening_type   TEXT NOT NULL DEFAULT '',
  opening_note   TEXT NOT NULL DEFAULT '',
  opened_by      TEXT,
  opened_at      TIMESTAMPTZ,
  closing_amount BIGINT,
  closing_type   TEXT NOT NULL DEFAULT '',
  closing_note   TEXT NOT NULL DEFAULT '',
  closed_by      TEXT,
  closed_at      TIMESTAMPTZ
);

-- ----------------------------------------------------------- player model ---

CREATE TABLE player_profiles (
  id                TEXT PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  nickname          TEXT NOT NULL,
  email             TEXT UNIQUE,
  password_hash     TEXT,
  role              user_role NOT NULL DEFAULT 'player',
  avatar            TEXT,
  skill_level       skill_level NOT NULL DEFAULT 'Rookie',
  bio               TEXT NOT NULL DEFAULT '',
  home_table        TEXT,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  membership_tier   membership_tier NOT NULL DEFAULT 'basic',
  membership_status membership_status NOT NULL DEFAULT 'active',
  membership_expiry TIMESTAMPTZ,
  loyalty_points    INT NOT NULL DEFAULT 0,
  loyalty_lifetime  INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX player_profiles_tier_idx ON player_profiles (membership_tier);

-- ------------------------------------------------------------- membership ---

CREATE TABLE membership_plans (
  id                 membership_tier PRIMARY KEY,
  name               TEXT NOT NULL,
  price              INT NOT NULL DEFAULT 0,
  billing_period     TEXT NOT NULL DEFAULT 'monthly',
  tagline            TEXT NOT NULL DEFAULT '',
  benefits           JSONB NOT NULL DEFAULT '[]',
  discount_pct       INT NOT NULL DEFAULT 0,
  booking_priority   INT NOT NULL DEFAULT 1,
  loyalty_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1,
  badge              TEXT NOT NULL DEFAULT 'Member',
  featured           BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'active',
  sort_order         INT NOT NULL DEFAULT 0
);

CREATE TABLE user_memberships (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  plan_id    membership_tier NOT NULL REFERENCES membership_plans(id),
  status     membership_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX user_memberships_player_idx ON user_memberships (player_id);

-- ------------------------------------------------------------ tournaments ---

CREATE TABLE tournaments (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  cover                 TEXT NOT NULL DEFAULT 'winter',
  summary               TEXT NOT NULL DEFAULT '',
  format                tournament_format NOT NULL DEFAULT 'single_elim',
  status                tournament_status NOT NULL DEFAULT 'registration_open',
  start_at              TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ NOT NULL,
  entry_fee             INT NOT NULL DEFAULT 0,
  prize_pool            INT NOT NULL DEFAULT 0,
  prize_breakdown       JSONB NOT NULL DEFAULT '[]',
  max_players           INT NOT NULL DEFAULT 8,
  venue                 TEXT NOT NULL DEFAULT '',
  rules                 JSONB NOT NULL DEFAULT '[]',
  champion_id           TEXT REFERENCES player_profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournament_registrations (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     TEXT REFERENCES player_profiles(id) ON DELETE CASCADE,
  seed          INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);
CREATE INDEX tournament_registrations_t_idx ON tournament_registrations (tournament_id);

CREATE TABLE tournament_matches (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INT NOT NULL,
  round_name    TEXT NOT NULL,
  position      INT NOT NULL,
  a_id          TEXT REFERENCES player_profiles(id),
  b_id          TEXT REFERENCES player_profiles(id),
  score_a       INT,
  score_b       INT,
  winner_id     TEXT REFERENCES player_profiles(id),
  scheduled_at  TIMESTAMPTZ,
  table_name    TEXT,
  next_match_id TEXT REFERENCES tournament_matches(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX tournament_matches_t_idx ON tournament_matches (tournament_id, round, position);

-- ---------------------------------------------------------------- matches ---

CREATE TABLE matches (
  id               TEXT PRIMARY KEY,
  ref              TEXT UNIQUE NOT NULL,
  type             match_type NOT NULL,
  player_a_id      TEXT NOT NULL REFERENCES player_profiles(id),
  player_b_id      TEXT NOT NULL REFERENCES player_profiles(id),
  score_a          INT NOT NULL,
  score_b          INT NOT NULL,
  winner_id        TEXT NOT NULL REFERENCES player_profiles(id),
  table_name       TEXT NOT NULL,
  tournament_id    TEXT REFERENCES tournaments(id) ON DELETE SET NULL,
  tournament_round TEXT,
  played_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  a_points_before  INT NOT NULL,
  a_points_after   INT NOT NULL,
  b_points_before  INT NOT NULL,
  b_points_after   INT NOT NULL,
  recorded_by      TEXT NOT NULL DEFAULT 'system',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player_a_id <> player_b_id),
  CHECK (score_a >= 0 AND score_b >= 0)
);
CREATE INDEX matches_played_idx     ON matches (played_at DESC);
CREATE INDEX matches_player_a_idx   ON matches (player_a_id);
CREATE INDEX matches_player_b_idx   ON matches (player_b_id);
CREATE INDEX matches_tournament_idx ON matches (tournament_id);

CREATE TABLE ranking_history (
  id        BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  points    INT NOT NULL,
  rank      INT NOT NULL,
  match_id  TEXT REFERENCES matches(id) ON DELETE CASCADE,
  reason    TEXT NOT NULL DEFAULT '',
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ranking_history_player_idx ON ranking_history (player_id, at);

-- ----------------------------------------------------- upcoming (schedule) ---

CREATE TABLE upcoming_matches (
  id            TEXT PRIMARY KEY,
  player_a_id   TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  player_b_id   TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  table_name    TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  round         TEXT,
  type          match_type NOT NULL DEFAULT 'ranked'
);
CREATE INDEX upcoming_matches_time_idx ON upcoming_matches (scheduled_at);

-- --------------------------------------------------- loyalty & rewards ------

CREATE TABLE rewards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost        INT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'play',
  icon        TEXT NOT NULL DEFAULT 'star',
  status      TEXT NOT NULL DEFAULT 'active',
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE loyalty_transactions (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  points       INT NOT NULL,
  reason       TEXT NOT NULL,
  source       loyalty_source NOT NULL,
  reference_id TEXT,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ
);
CREATE INDEX loyalty_player_idx ON loyalty_transactions (player_id, at DESC);

-- ------------------------------------------------------------- promotions ---

CREATE TABLE promotions (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT UNIQUE NOT NULL,
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  type                   TEXT NOT NULL DEFAULT 'limited',
  image                  TEXT NOT NULL DEFAULT 'navy',
  start_at               TIMESTAMPTZ NOT NULL,
  end_at                 TIMESTAMPTZ NOT NULL,
  eligibility            TEXT NOT NULL DEFAULT 'Everyone',
  discount               TEXT NOT NULL DEFAULT '',
  promo_code             TEXT,
  membership_restriction JSONB,
  usage_note             TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------- achievements ---

CREATE TABLE achievements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'target',
  tier        TEXT NOT NULL DEFAULT 'bronze',
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE player_achievements (
  player_id      TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, achievement_id)
);

-- ----------------------------------------------------- venue directory -----

CREATE TABLE venues (
  id                TEXT PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  logo              TEXT,
  cover             TEXT,
  district          TEXT,
  city              TEXT,
  address           TEXT,
  table_count       INT NOT NULL DEFAULT 0,
  table_types       JSONB NOT NULL DEFAULT '[]',
  hourly_rate_from  INT,
  facilities        JSONB NOT NULL DEFAULT '[]',
  phone             TEXT,
  socials           JSONB NOT NULL DEFAULT '{}',
  maps_url          TEXT,
  rating            NUMERIC(2,1),
  review_count      INT NOT NULL DEFAULT 0,
  online_booking    BOOLEAN NOT NULL DEFAULT false,
  hosts_tournaments BOOLEAN NOT NULL DEFAULT false,
  is_primary        BOOLEAN NOT NULL DEFAULT false
);

-- ------------------------------------------------------------- audit log ---

CREATE TABLE audit_log (
  id        TEXT PRIMARY KEY,
  actor     TEXT NOT NULL,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail    TEXT NOT NULL DEFAULT '',
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_at_idx ON audit_log (at DESC);
