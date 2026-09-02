/* ============================================================
   Cue Point ecosystem store — raw SQL over Postgres.

   Server-side data + service layer for players, matches,
   rankings, tournaments, membership, loyalty and promotions.
   All access to the player-ecosystem tables goes through here.
   Schema: db/schema.sql · setup: scripts/setup.ts
   ============================================================ */

import { query, queryOne, transaction } from "../pg";
import {
  assignRanks,
  pointsInWindow,
  RANKING_CONFIG,
  replayMatches,
  type PlayerRatingState,
} from "./ranking";
import type {
  Achievement,
  AuditEntry,
  BracketMatch,
  LeaderboardRow,
  LoyaltyTransaction,
  Match,
  MatchType,
  MatchView,
  MembershipPlan,
  PlayerLite,
  PlayerProfile,
  PlayerProfileView,
  PlayerStats,
  Promotion,
  RankingScope,
  Reward,
  Tournament,
  TournamentPlayerSlot,
  TournamentStatus,
  UpcomingMatch,
  UpcomingMatchView,
  Venue,
} from "./types";

export const ECOSYSTEM_HAS_DB = !!process.env.DATABASE_URL;

const DAY = 86_400_000;

/* -------------------------------------------------------------------- */
/*  Row mappers                                                        */
/* -------------------------------------------------------------------- */

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v);
const isoOrNull = (v: unknown): string | null =>
  v == null ? null : iso(v);
const num = (v: unknown): number => Number(v ?? 0);

type Row = Record<string, unknown>;

function mapPlayer(r: Row): PlayerProfile {
  return {
    id: r.id as string,
    slug: r.slug as string,
    fullName: r.full_name as string,
    nickname: r.nickname as string,
    email: (r.email as string) ?? null,
    role: r.role as PlayerProfile["role"],
    avatar: (r.avatar as string) ?? null,
    skillLevel: r.skill_level as PlayerProfile["skillLevel"],
    bio: (r.bio as string) ?? "",
    homeTable: (r.home_table as string) ?? null,
    joinedAt: iso(r.joined_at),
    membershipTier: r.membership_tier as PlayerProfile["membershipTier"],
    membershipStatus: r.membership_status as PlayerProfile["membershipStatus"],
    membershipExpiry: isoOrNull(r.membership_expiry),
    loyaltyPoints: num(r.loyalty_points),
    loyaltyLifetime: num(r.loyalty_lifetime),
    achievementIds: (r.achievement_ids as string[]) ?? [],
  };
}

function mapMatch(r: Row): Match {
  return {
    id: r.id as string,
    ref: r.ref as string,
    type: r.type as MatchType,
    playerAId: r.player_a_id as string,
    playerBId: r.player_b_id as string,
    scoreA: num(r.score_a),
    scoreB: num(r.score_b),
    winnerId: r.winner_id as string,
    tableName: r.table_name as string,
    tournamentId: (r.tournament_id as string) ?? null,
    tournamentRound: (r.tournament_round as string) ?? null,
    playedAt: iso(r.played_at),
    aPointsBefore: num(r.a_points_before),
    aPointsAfter: num(r.a_points_after),
    bPointsBefore: num(r.b_points_before),
    bPointsAfter: num(r.b_points_after),
    recordedBy: r.recorded_by as string,
  };
}

function liteFromJoin(r: Row, p: "a" | "b", rank: number): PlayerLite {
  return {
    id: r[`player_${p}_id`] as string,
    slug: r[`${p}_slug`] as string,
    nickname: r[`${p}_nick`] as string,
    fullName: r[`${p}_full`] as string,
    avatar: (r[`${p}_avatar`] as string) ?? null,
    rank,
    skillLevel: r[`${p}_skill`] as PlayerLite["skillLevel"],
    membershipTier: r[`${p}_tier`] as PlayerLite["membershipTier"],
  };
}

export function toPlayerLite(p: PlayerProfile, rank: number): PlayerLite {
  return {
    id: p.id,
    slug: p.slug,
    nickname: p.nickname,
    fullName: p.fullName,
    avatar: p.avatar,
    rank,
    skillLevel: p.skillLevel,
    membershipTier: p.membershipTier,
  };
}

function mapMembershipPlan(r: Row): MembershipPlan {
  return {
    id: r.id as MembershipPlan["id"],
    name: r.name as string,
    price: num(r.price),
    billingPeriod: r.billing_period as MembershipPlan["billingPeriod"],
    tagline: r.tagline as string,
    benefits: (r.benefits as string[]) ?? [],
    discountPct: num(r.discount_pct),
    bookingPriority: num(r.booking_priority),
    loyaltyMultiplier: num(r.loyalty_multiplier),
    badge: r.badge as string,
    featured: !!r.featured,
    status: r.status as MembershipPlan["status"],
  };
}

function mapReward(r: Row): Reward {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    cost: num(r.cost),
    category: r.category as Reward["category"],
    icon: r.icon as string,
    status: r.status as Reward["status"],
  };
}

function mapAchievement(r: Row): Achievement {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    icon: r.icon as string,
    tier: r.tier as Achievement["tier"],
  };
}

function mapPromotion(r: Row): Promotion {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: r.description as string,
    type: r.type as Promotion["type"],
    image: r.image as string,
    startAt: iso(r.start_at),
    endAt: iso(r.end_at),
    eligibility: r.eligibility as string,
    discount: r.discount as string,
    promoCode: (r.promo_code as string) ?? null,
    membershipRestriction:
      (r.membership_restriction as Promotion["membershipRestriction"]) ?? null,
    usageNote: (r.usage_note as string) ?? null,
    status: (r.status as Promotion["status"]) ?? "active",
  };
}

function mapVenue(r: Row): Venue {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    logo: (r.logo as string) ?? null,
    cover: (r.cover as string) ?? null,
    district: r.district as string,
    city: r.city as string,
    address: r.address as string,
    tableCount: num(r.table_count),
    tableTypes: (r.table_types as string[]) ?? [],
    hourlyRateFrom: num(r.hourly_rate_from),
    facilities: (r.facilities as string[]) ?? [],
    phone: (r.phone as string) ?? null,
    socials: (r.socials as Record<string, string>) ?? {},
    mapsUrl: (r.maps_url as string) ?? null,
    rating: r.rating == null ? null : num(r.rating),
    reviewCount: num(r.review_count),
    onlineBooking: !!r.online_booking,
    hostsTournaments: !!r.hosts_tournaments,
    isPrimary: !!r.is_primary,
  };
}

function mapBracketMatch(r: Row): BracketMatch {
  return {
    id: r.id as string,
    round: num(r.round),
    roundName: r.round_name as string,
    position: num(r.position),
    aId: (r.a_id as string) ?? null,
    bId: (r.b_id as string) ?? null,
    scoreA: r.score_a == null ? null : num(r.score_a),
    scoreB: r.score_b == null ? null : num(r.score_b),
    winnerId: (r.winner_id as string) ?? null,
    scheduledAt: isoOrNull(r.scheduled_at),
    tableName: (r.table_name as string) ?? null,
    nextMatchId: (r.next_match_id as string) ?? null,
  };
}

function mapTournamentBase(r: Row): Omit<Tournament, "registrations" | "bracket"> {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    cover: r.cover as string,
    summary: r.summary as string,
    format: r.format as Tournament["format"],
    status: r.status as TournamentStatus,
    startAt: iso(r.start_at),
    registrationDeadline: iso(r.registration_deadline),
    entryFee: num(r.entry_fee),
    prizePool: num(r.prize_pool),
    prizeBreakdown: (r.prize_breakdown as Tournament["prizeBreakdown"]) ?? [],
    maxPlayers: num(r.max_players),
    venue: r.venue as string,
    rules: (r.rules as string[]) ?? [],
    championId: (r.champion_id as string) ?? null,
  };
}

/* -------------------------------------------------------------------- */
/*  Derived stats — replayed from the match log (req 22)               */
/* -------------------------------------------------------------------- */

export interface StatsBundle {
  stats: Map<string, PlayerStats>;
  states: Map<string, PlayerRatingState>;
  ranks: Map<string, number>;
  matches: Match[];
  players: PlayerProfile[];
}

let _cache: { key: string; bundle: StatsBundle } | null = null;

function windowStart(scope: RankingScope): string | null {
  const now = Date.now();
  if (scope === "weekly") return new Date(now - 7 * DAY).toISOString();
  if (scope === "monthly") return new Date(now - 30 * DAY).toISOString();
  return null;
}

export async function computeStats(): Promise<StatsBundle> {
  // Cache key must move whenever the match log OR the player roster changes —
  // a freshly registered player has no matches, so a matches-only key would
  // keep serving a stale bundle that has no stats entry for them.
  const [{ c, m, pc, pm }] = await query<{
    c: number;
    m: string | null;
    pc: number;
    pm: string | null;
  }>(
    `SELECT
       (SELECT count(*)::int FROM matches) AS c,
       (SELECT COALESCE(max(created_at)::text, '-') FROM matches) AS m,
       (SELECT count(*)::int FROM player_profiles) AS pc,
       (SELECT COALESCE(max(created_at)::text, '-') FROM player_profiles) AS pm`,
  );
  const key = `${c}:${m}:${pc}:${pm}`;
  if (_cache && _cache.key === key) return _cache.bundle;

  const [playerRows, matchRows, champRows] = await Promise.all([
    // rankings / stats are for players only — staff & admin accounts don't rank
    query<Row>(`SELECT * FROM player_profiles WHERE role = 'player'`),
    query<Row>(`SELECT * FROM matches ORDER BY played_at ASC`),
    query<Row>(
      `SELECT champion_id FROM tournaments WHERE champion_id IS NOT NULL`,
    ),
  ]);

  const players = playerRows.map(mapPlayer);
  const matches = matchRows.map(mapMatch);
  const titlesByPlayer = new Map<string, number>();
  for (const t of champRows) {
    const id = t.champion_id as string;
    titlesByPlayer.set(id, (titlesByPlayer.get(id) ?? 0) + 1);
  }

  const { states } = replayMatches(matches);

  const pointsNow = new Map<string, number>();
  for (const p of players) {
    pointsNow.set(p.id, states.get(p.id)?.points ?? RANKING_CONFIG.startPoints);
  }
  const ranks = assignRanks(pointsNow);

  const cutoff = Date.now() - 7 * DAY;
  const priorStates = replayMatches(
    matches.filter((x) => +new Date(x.playedAt) < cutoff),
  ).states;
  const pointsPrior = new Map<string, number>();
  for (const p of players) {
    pointsPrior.set(
      p.id,
      priorStates.get(p.id)?.points ?? RANKING_CONFIG.startPoints,
    );
  }
  const ranksPrior = assignRanks(pointsPrior);

  // one pass over matches for per-player aggregates
  interface Agg {
    played: number;
    wins: number;
    ranked: number;
    tourneys: Set<string>;
    bestBreak: number;
  }
  const agg = new Map<string, Agg>();
  const getA = (id: string) => {
    let a = agg.get(id);
    if (!a) {
      a = { played: 0, wins: 0, ranked: 0, tourneys: new Set(), bestBreak: 0 };
      agg.set(id, a);
    }
    return a;
  };
  for (const mm of matches) {
    for (const pid of [mm.playerAId, mm.playerBId]) {
      const a = getA(pid);
      a.played += 1;
      if (mm.type !== "casual") a.ranked += 1;
      if (mm.tournamentId) a.tourneys.add(mm.tournamentId);
    }
    const wa = getA(mm.winnerId);
    wa.wins += 1;
    const margin = Math.abs(mm.scoreA - mm.scoreB);
    wa.bestBreak = Math.max(
      wa.bestBreak,
      40 + margin * 12 + (mm.type === "tournament" ? 20 : 0),
    );
  }

  const stats = new Map<string, PlayerStats>();
  for (const p of players) {
    const st = states.get(p.id) ?? {
      points: RANKING_CONFIG.startPoints,
      played: 0,
      form: [],
      streak: 0,
      lastMatchAt: null,
      history: [],
    };
    const a = agg.get(p.id) ?? {
      played: 0,
      wins: 0,
      ranked: 0,
      tourneys: new Set<string>(),
      bestBreak: 0,
    };
    const rank = ranks.get(p.id) ?? 0;
    const prevRank = ranksPrior.get(p.id) ?? rank;
    stats.set(p.id, {
      playerId: p.id,
      matchesPlayed: a.played,
      wins: a.wins,
      losses: a.played - a.wins,
      winPct: a.played ? +((a.wins / a.played) * 100).toFixed(1) : 0,
      rankingPoints: Math.round(st.points),
      rank,
      previousRank: prevRank,
      rankMovement: prevRank - rank,
      recentForm: st.form,
      bestBreak: a.bestBreak,
      streak: st.streak,
      rankedMatches: a.ranked,
      tournamentsPlayed: a.tourneys.size,
      titlesWon: titlesByPlayer.get(p.id) ?? 0,
    });
  }

  const bundle: StatsBundle = { stats, states, ranks, matches, players };
  _cache = { key, bundle };
  return bundle;
}

export function invalidateStatsCache() {
  _cache = null;
}

/* -------------------------------------------------------------------- */
/*  Simple lookups                                                     */
/* -------------------------------------------------------------------- */

export async function getPlayers(
  opts: { includeStaff?: boolean } = {},
): Promise<PlayerProfile[]> {
  const rows = await query<Row>(
    `SELECT p.*,
       COALESCE(array_agg(pa.achievement_id) FILTER (WHERE pa.achievement_id IS NOT NULL), '{}') AS achievement_ids
     FROM player_profiles p
     LEFT JOIN player_achievements pa ON pa.player_id = p.id
     ${opts.includeStaff ? "" : "WHERE p.role = 'player'"}
     GROUP BY p.id
     ORDER BY p.nickname`,
  );
  return rows.map(mapPlayer);
}

export async function getPlayerBySlug(
  slug: string,
): Promise<PlayerProfile | undefined> {
  const r = await queryOne<Row>(
    `SELECT p.*,
       COALESCE(array_agg(pa.achievement_id) FILTER (WHERE pa.achievement_id IS NOT NULL), '{}') AS achievement_ids
     FROM player_profiles p
     LEFT JOIN player_achievements pa ON pa.player_id = p.id
     WHERE p.slug = $1 GROUP BY p.id`,
    [slug],
  );
  return r ? mapPlayer(r) : undefined;
}

export async function getPlayerById(
  id: string,
): Promise<PlayerProfile | undefined> {
  const r = await queryOne<Row>(
    `SELECT p.*,
       COALESCE(array_agg(pa.achievement_id) FILTER (WHERE pa.achievement_id IS NOT NULL), '{}') AS achievement_ids
     FROM player_profiles p
     LEFT JOIN player_achievements pa ON pa.player_id = p.id
     WHERE p.id = $1 GROUP BY p.id`,
    [id],
  );
  return r ? mapPlayer(r) : undefined;
}

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const rows = await query<Row>(
    `SELECT * FROM membership_plans WHERE status = 'active' ORDER BY sort_order, price`,
  );
  return rows.map(mapMembershipPlan);
}

export async function getRewards(): Promise<Reward[]> {
  const rows = await query<Row>(
    `SELECT * FROM rewards WHERE status = 'active' ORDER BY sort_order, cost`,
  );
  return rows.map(mapReward);
}

export async function getAchievements(): Promise<Achievement[]> {
  const rows = await query<Row>(`SELECT * FROM achievements ORDER BY sort_order`);
  return rows.map(mapAchievement);
}

export async function getVenues(): Promise<Venue[]> {
  const rows = await query<Row>(
    `SELECT * FROM venues ORDER BY is_primary DESC, name`,
  );
  return rows.map(mapVenue);
}

export async function getAudit(): Promise<AuditEntry[]> {
  const rows = await query<Row>(
    `SELECT * FROM audit_log ORDER BY at DESC LIMIT 200`,
  );
  return rows.map((r) => ({
    id: r.id as string,
    actor: r.actor as string,
    action: r.action as string,
    entity: r.entity as string,
    entityId: r.entity_id as string,
    detail: r.detail as string,
    at: iso(r.at),
  }));
}

/* -------------------------------------------------------------------- */
/*  Leaderboard                                                        */
/* -------------------------------------------------------------------- */

export async function getLeaderboard(
  scope: RankingScope = "all_time",
): Promise<LeaderboardRow[]> {
  const { stats, states, matches, players } = await computeStats();
  const since = windowStart(scope);

  const rows = players.map((p) => {
    const s = stats.get(p.id)!;

    const scopedMatches =
      scope === "tournament"
        ? matches.filter(
            (m) =>
              m.type === "tournament" &&
              (m.playerAId === p.id || m.playerBId === p.id),
          )
        : since
          ? matches.filter(
              (m) =>
                +new Date(m.playedAt) >= +new Date(since) &&
                (m.playerAId === p.id || m.playerBId === p.id),
            )
          : matches.filter(
              (m) => m.playerAId === p.id || m.playerBId === p.id,
            );

    const wins = scopedMatches.filter((m) => m.winnerId === p.id).length;
    const losses = scopedMatches.length - wins;

    const scopedPoints =
      scope === "all_time" || scope === "tournament"
        ? s.rankingPoints
        : RANKING_CONFIG.startPoints +
          pointsInWindow(states.get(p.id) ?? emptyState(), since!);

    return {
      ...toPlayerLite(p, s.rank),
      matchesPlayed: scopedMatches.length,
      wins,
      losses,
      winPct: scopedMatches.length
        ? +((wins / scopedMatches.length) * 100).toFixed(1)
        : 0,
      rankingPoints: Math.round(scopedPoints),
      recentForm: s.recentForm,
      rankMovement: s.rankMovement,
      streak: s.streak,
    } satisfies LeaderboardRow;
  });

  const filtered =
    scope === "all_time" ? rows : rows.filter((r) => r.matchesPlayed > 0);
  filtered.sort((a, b) => b.rankingPoints - a.rankingPoints || b.wins - a.wins);
  filtered.forEach((r, i) => (r.rank = i + 1));
  return filtered;
}

function emptyState(): PlayerRatingState {
  return {
    points: RANKING_CONFIG.startPoints,
    played: 0,
    form: [],
    streak: 0,
    lastMatchAt: null,
    history: [],
  };
}

/* -------------------------------------------------------------------- */
/*  Matches                                                            */
/* -------------------------------------------------------------------- */

const MATCH_SELECT = `
  SELECT m.*,
    pa.slug a_slug, pa.nickname a_nick, pa.full_name a_full, pa.avatar a_avatar,
    pa.skill_level a_skill, pa.membership_tier a_tier,
    pb.slug b_slug, pb.nickname b_nick, pb.full_name b_full, pb.avatar b_avatar,
    pb.skill_level b_skill, pb.membership_tier b_tier,
    t.name AS tournament_name
  FROM matches m
  JOIN player_profiles pa ON pa.id = m.player_a_id
  JOIN player_profiles pb ON pb.id = m.player_b_id
  LEFT JOIN tournaments t ON t.id = m.tournament_id
`;

export interface MatchFilter {
  type?: MatchType;
  playerId?: string;
  result?: "W" | "L";
  from?: string;
  to?: string;
  limit?: number;
}

function rowToMatchView(r: Row, ranks: Map<string, number>): MatchView {
  const base = mapMatch(r);
  return {
    ...base,
    playerA: liteFromJoin(r, "a", ranks.get(base.playerAId) ?? 0),
    playerB: liteFromJoin(r, "b", ranks.get(base.playerBId) ?? 0),
    tournamentName: (r.tournament_name as string) ?? null,
  };
}

export async function getMatches(
  filter: MatchFilter = {},
): Promise<MatchView[]> {
  const { ranks } = await computeStats();
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filter.type) where.push(`m.type = ${p(filter.type)}`);
  if (filter.playerId) {
    const ph = p(filter.playerId);
    where.push(`(m.player_a_id = ${ph} OR m.player_b_id = ${ph})`);
  }
  if (filter.playerId && filter.result) {
    const ph = p(filter.playerId);
    where.push(
      filter.result === "W"
        ? `m.winner_id = ${ph}`
        : `m.winner_id <> ${ph}`,
    );
  }
  if (filter.from) where.push(`m.played_at >= ${p(filter.from)}`);
  if (filter.to) where.push(`m.played_at <= ${p(filter.to)}`);

  const sql =
    MATCH_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY m.played_at DESC LIMIT ${Math.min(500, filter.limit ?? 60)}`;

  const rows = await query<Row>(sql, params);
  return rows.map((r) => rowToMatchView(r, ranks));
}

export async function getUpcomingMatches(
  playerId?: string,
): Promise<UpcomingMatchView[]> {
  const { ranks } = await computeStats();
  const params: unknown[] = [];
  let where = "";
  if (playerId) {
    params.push(playerId);
    where = `WHERE u.player_a_id = $1 OR u.player_b_id = $1`;
  }
  const rows = await query<Row>(
    `SELECT u.*,
       pa.slug a_slug, pa.nickname a_nick, pa.full_name a_full, pa.avatar a_avatar,
       pa.skill_level a_skill, pa.membership_tier a_tier,
       pb.slug b_slug, pb.nickname b_nick, pb.full_name b_full, pb.avatar b_avatar,
       pb.skill_level b_skill, pb.membership_tier b_tier,
       t.name AS tournament_name
     FROM upcoming_matches u
     JOIN player_profiles pa ON pa.id = u.player_a_id
     JOIN player_profiles pb ON pb.id = u.player_b_id
     LEFT JOIN tournaments t ON t.id = u.tournament_id
     ${where}
     ORDER BY u.scheduled_at ASC`,
    params,
  );
  return rows.map((r) => {
    const base: UpcomingMatch = {
      id: r.id as string,
      playerAId: r.player_a_id as string,
      playerBId: r.player_b_id as string,
      tableName: r.table_name as string,
      scheduledAt: iso(r.scheduled_at),
      tournamentId: (r.tournament_id as string) ?? null,
      round: (r.round as string) ?? null,
      type: r.type as MatchType,
    };
    return {
      ...base,
      playerA: liteFromJoin(r, "a", ranks.get(base.playerAId) ?? 0),
      playerB: liteFromJoin(r, "b", ranks.get(base.playerBId) ?? 0),
      tournamentName: (r.tournament_name as string) ?? null,
    };
  });
}

/* -------------------------------------------------------------------- */
/*  Player profile view                                                */
/* -------------------------------------------------------------------- */

/** A player with no matches yet — used until they appear in the match log. */
function zeroStats(playerId: string): PlayerStats {
  return {
    playerId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winPct: 0,
    rankingPoints: RANKING_CONFIG.startPoints,
    rank: 0,
    previousRank: 0,
    rankMovement: 0,
    recentForm: [],
    bestBreak: 0,
    streak: 0,
    rankedMatches: 0,
    tournamentsPlayed: 0,
    titlesWon: 0,
  };
}

export async function getPlayerProfileView(
  slug: string,
): Promise<PlayerProfileView | null> {
  const profile = await getPlayerBySlug(slug);
  if (!profile) return null;
  // staff & admin accounts aren't players — no public profile / rank
  if (profile.role !== "player") return null;

  const { stats } = await computeStats();
  const s = stats.get(profile.id) ?? zeroStats(profile.id);

  const [achRows, recentMatches, tournaments, upcomingMatches, planRow] =
    await Promise.all([
      query<Row>(
        `SELECT a.* FROM achievements a
         JOIN player_achievements pa ON pa.achievement_id = a.id
         WHERE pa.player_id = $1 ORDER BY a.sort_order`,
        [profile.id],
      ),
      getMatches({ playerId: profile.id, limit: 8 }),
      getTournamentsForPlayer(profile.id),
      getUpcomingMatches(profile.id),
      queryOne<Row>(`SELECT * FROM membership_plans WHERE id = $1`, [
        profile.membershipTier,
      ]),
    ]);

  const tournamentHistory = tournaments.map((t) => ({
    tournamentId: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    placement:
      t.championId === profile.id
        ? "Champion"
        : t.status === "completed"
          ? placementFor(t, profile.id)
          : null,
  }));

  return {
    profile,
    stats: s,
    achievements: achRows.map(mapAchievement),
    recentMatches,
    tournamentHistory,
    upcomingMatches,
    membershipPlan: planRow ? mapMembershipPlan(planRow) : null,
  };
}

function placementFor(t: Tournament, playerId: string): string | null {
  const finals = t.bracket
    .filter((m) => m.winnerId)
    .sort((a, b) => b.round - a.round);
  if (!finals.length) return "Participant";
  const final = finals[0];
  if (final.aId === playerId || final.bId === playerId) return "Runner-up";
  const semi = t.bracket.filter(
    (m) =>
      m.round === final.round - 1 &&
      (m.aId === playerId || m.bId === playerId),
  );
  if (semi.length) return "Semi-finalist";
  return "Participant";
}

/* -------------------------------------------------------------------- */
/*  Loyalty                                                            */
/* -------------------------------------------------------------------- */

export async function getLoyaltyForPlayer(
  playerId: string,
): Promise<LoyaltyTransaction[]> {
  const rows = await query<Row>(
    `SELECT * FROM loyalty_transactions WHERE player_id = $1 ORDER BY at DESC`,
    [playerId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    playerId: r.player_id as string,
    points: num(r.points),
    reason: r.reason as string,
    source: r.source as LoyaltyTransaction["source"],
    referenceId: (r.reference_id as string) ?? null,
    at: iso(r.at),
    expiresAt: isoOrNull(r.expires_at),
  }));
}

export async function addLoyaltyTransaction(
  input: Omit<LoyaltyTransaction, "id" | "at">,
  actor: string,
): Promise<LoyaltyTransaction> {
  const id = "lt_" + rid();
  const at = new Date().toISOString();
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO loyalty_transactions
        (id, player_id, points, reason, source, reference_id, at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        input.playerId,
        input.points,
        input.reason,
        input.source,
        input.referenceId,
        at,
        input.expiresAt,
      ],
    );
    await client.query(
      `UPDATE player_profiles
       SET loyalty_points = GREATEST(0, loyalty_points + $2),
           loyalty_lifetime = loyalty_lifetime + GREATEST(0, $2)
       WHERE id = $1`,
      [input.playerId, input.points],
    );
    await client.query(
      `INSERT INTO audit_log (id, actor, action, entity, entity_id, detail)
       VALUES ($1,$2,'loyalty.adjust','player',$3,$4)`,
      ["au_" + rid(), actor, input.playerId, `${input.points} pts · ${input.reason}`],
    );
  });
  return { ...input, id, at };
}

/* -------------------------------------------------------------------- */
/*  Promotions                                                         */
/* -------------------------------------------------------------------- */

export function promotionState(
  p: Promotion,
): "upcoming" | "active" | "expired" {
  const now = Date.now();
  if (now < +new Date(p.startAt)) return "upcoming";
  if (now > +new Date(p.endAt)) return "expired";
  return "active";
}

export async function getPromotions(opts: {
  includeExpired?: boolean;
  includeHidden?: boolean;
} = {}): Promise<(Promotion & { state: "upcoming" | "active" | "expired" })[]> {
  const rows = await query<Row>(`SELECT * FROM promotions ORDER BY start_at`);
  return rows
    .map(mapPromotion)
    .filter((p) => opts.includeHidden || p.status !== "hidden")
    .map((p) => ({ ...p, state: promotionState(p) }))
    .filter((p) => opts.includeExpired || p.state !== "expired");
}

/* -------------------------------------------------------------------- */
/*  Tournaments                                                        */
/* -------------------------------------------------------------------- */

async function assembleTournaments(baseRows: Row[]): Promise<Tournament[]> {
  if (!baseRows.length) return [];
  const ids = baseRows.map((r) => r.id as string);
  const [regRows, bracketRows] = await Promise.all([
    query<Row>(
      `SELECT * FROM tournament_registrations WHERE tournament_id = ANY($1)`,
      [ids],
    ),
    query<Row>(
      `SELECT * FROM tournament_matches WHERE tournament_id = ANY($1)
       ORDER BY round, position`,
      [ids],
    ),
  ]);
  const regsByT = new Map<string, TournamentPlayerSlot[]>();
  for (const r of regRows) {
    const tid = r.tournament_id as string;
    if (!regsByT.has(tid)) regsByT.set(tid, []);
    regsByT.get(tid)!.push({
      registrationId: r.id as string,
      playerId: (r.player_id as string) ?? null,
      seed: r.seed == null ? null : num(r.seed),
    });
  }
  const bracketByT = new Map<string, BracketMatch[]>();
  for (const r of bracketRows) {
    const tid = r.tournament_id as string;
    if (!bracketByT.has(tid)) bracketByT.set(tid, []);
    bracketByT.get(tid)!.push(mapBracketMatch(r));
  }
  return baseRows.map((r) => {
    const base = mapTournamentBase(r);
    return {
      ...base,
      registrations: regsByT.get(base.id) ?? [],
      bracket: bracketByT.get(base.id) ?? [],
    };
  });
}

export async function getTournaments(): Promise<Tournament[]> {
  const rows = await query<Row>(`SELECT * FROM tournaments ORDER BY start_at`);
  return assembleTournaments(rows);
}

export async function getTournamentBySlug(
  slug: string,
): Promise<Tournament | undefined> {
  const rows = await query<Row>(`SELECT * FROM tournaments WHERE slug = $1`, [
    slug,
  ]);
  return (await assembleTournaments(rows))[0];
}

async function getTournamentsForPlayer(
  playerId: string,
): Promise<Tournament[]> {
  const rows = await query<Row>(
    `SELECT DISTINCT t.* FROM tournaments t
     JOIN tournament_registrations tr ON tr.tournament_id = t.id
     WHERE tr.player_id = $1 ORDER BY t.start_at`,
    [playerId],
  );
  return assembleTournaments(rows);
}

export function tournamentSpotsLeft(t: Tournament): number {
  return Math.max(
    0,
    t.maxPlayers - t.registrations.filter((r) => r.playerId).length,
  );
}

export function derivedTournamentStatus(t: Tournament): TournamentStatus {
  if (t.status === "cancelled" || t.status === "completed") return t.status;
  const now = Date.now();
  if (t.championId) return "completed";
  if (now >= +new Date(t.startAt)) return "live";
  if (now > +new Date(t.registrationDeadline)) return "registration_closed";
  return t.status === "upcoming" ? "upcoming" : "registration_open";
}

export interface RegistrationResult {
  ok: boolean;
  error?: string;
  tournament?: Tournament;
}

export async function registerForTournament(
  slug: string,
  playerId: string,
): Promise<RegistrationResult> {
  const t = await getTournamentBySlug(slug);
  if (!t) return { ok: false, error: "Tournament not found" };
  if (derivedTournamentStatus(t) !== "registration_open")
    return { ok: false, error: "Registration is closed for this tournament" };
  if (t.registrations.some((r) => r.playerId === playerId))
    return { ok: false, error: "You are already registered" };
  if (tournamentSpotsLeft(t) <= 0)
    return { ok: false, error: "This tournament is full" };

  try {
    await query(
      `INSERT INTO tournament_registrations (id, tournament_id, player_id, seed)
       VALUES ($1,$2,$3,NULL)`,
      ["reg_" + rid(), t.id, playerId],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return { ok: false, error: "You are already registered" };
    throw e;
  }
  await audit("system", "tournament.register", "tournament", t.id, `player ${playerId}`);
  return { ok: true, tournament: await getTournamentBySlug(slug) };
}

export async function isRegistered(
  slug: string,
  playerId: string | null,
): Promise<boolean> {
  if (!playerId) return false;
  const r = await queryOne(
    `SELECT 1 FROM tournament_registrations tr
     JOIN tournaments t ON t.id = tr.tournament_id
     WHERE t.slug = $1 AND tr.player_id = $2`,
    [slug, playerId],
  );
  return !!r;
}

/* -------------------------------------------------------------------- */
/*  Staff: record an official match result (req 5)                     */
/* -------------------------------------------------------------------- */

export interface RecordMatchInput {
  type: MatchType;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
  tableName: string;
  tournamentId?: string | null;
  tournamentRound?: string | null;
  playedAt?: string;
}

export interface RecordMatchResult {
  ok: boolean;
  error?: string;
  match?: MatchView;
}

export async function recordMatch(
  input: RecordMatchInput,
  actor: string,
): Promise<RecordMatchResult> {
  const [a, b] = await Promise.all([
    getPlayerById(input.playerAId),
    getPlayerById(input.playerBId),
  ]);
  if (!a || !b) return { ok: false, error: "Unknown player" };
  if (a.id === b.id) return { ok: false, error: "Players must be different" };
  if (![a.id, b.id].includes(input.winnerId))
    return { ok: false, error: "Winner must be one of the two players" };
  if (input.scoreA < 0 || input.scoreB < 0)
    return { ok: false, error: "Scores cannot be negative" };
  const higher = input.scoreA > input.scoreB ? a.id : b.id;
  if (input.scoreA !== input.scoreB && higher !== input.winnerId)
    return { ok: false, error: "Winner does not match the scoreline" };

  const before = (await computeStats()).stats;
  const aBefore = before.get(a.id)?.rankingPoints ?? RANKING_CONFIG.startPoints;
  const bBefore = before.get(b.id)?.rankingPoints ?? RANKING_CONFIG.startPoints;

  const id = "m_" + rid();
  const ref = "CP-M-" + rid().slice(0, 5).toUpperCase();
  const playedAt = input.playedAt ?? new Date().toISOString();

  await query(
    `INSERT INTO matches
      (id, ref, type, player_a_id, player_b_id, score_a, score_b, winner_id,
       table_name, tournament_id, tournament_round, played_at,
       a_points_before, a_points_after, b_points_before, b_points_after, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$14,$15)`,
    [
      id,
      ref,
      input.type,
      a.id,
      b.id,
      input.scoreA,
      input.scoreB,
      input.winnerId,
      input.tableName,
      input.tournamentId ?? null,
      input.tournamentRound ?? null,
      playedAt,
      aBefore,
      bBefore,
      actor,
    ],
  );

  invalidateStatsCache();
  const after = (await computeStats()).stats;
  const aAfter = after.get(a.id)?.rankingPoints ?? aBefore;
  const bAfter = after.get(b.id)?.rankingPoints ?? bBefore;
  const aRank = after.get(a.id)?.rank ?? 0;
  const bRank = after.get(b.id)?.rank ?? 0;

  await query(
    `UPDATE matches SET a_points_after = $2, b_points_after = $3 WHERE id = $1`,
    [id, aAfter, bAfter],
  );
  await query(
    `INSERT INTO ranking_history (player_id, points, rank, match_id, reason)
     VALUES ($1,$2,$3,$5,$7), ($4,$6,$8,$5,$7)`,
    [a.id, aAfter, aRank, b.id, id, bAfter, `match ${ref}`, bRank],
  );

  if (input.tournamentId) {
    await advanceBracket(input.tournamentId, {
      id,
      aId: a.id,
      bId: b.id,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      winnerId: input.winnerId,
    });
  }

  await audit(
    actor,
    "match.create",
    "match",
    id,
    `${a.nickname} ${input.scoreA}-${input.scoreB} ${b.nickname} (${input.type})`,
  );

  const view = (await getMatches({ playerId: a.id, limit: 1 })).find(
    (m) => m.id === id,
  );
  return { ok: true, match: view };
}

async function advanceBracket(
  tournamentId: string,
  m: {
    id: string;
    aId: string;
    bId: string;
    scoreA: number;
    scoreB: number;
    winnerId: string;
  },
) {
  const bmRows = await query<Row>(
    `SELECT * FROM tournament_matches
     WHERE tournament_id = $1 AND winner_id IS NULL
       AND ((a_id = $2 AND b_id = $3) OR (a_id = $3 AND b_id = $2))
     ORDER BY round LIMIT 1`,
    [tournamentId, m.aId, m.bId],
  );
  const bm = bmRows[0];
  if (!bm) return;

  const scoreForBmA = bm.a_id === m.aId ? m.scoreA : m.scoreB;
  const scoreForBmB = bm.a_id === m.aId ? m.scoreB : m.scoreA;

  await transaction(async (client) => {
    await client.query(
      `UPDATE tournament_matches SET score_a=$2, score_b=$3, winner_id=$4 WHERE id=$1`,
      [bm.id, scoreForBmA, scoreForBmB, m.winnerId],
    );
    if (bm.next_match_id) {
      // fill first empty slot in the next match
      await client.query(
        `UPDATE tournament_matches
         SET a_id = CASE WHEN a_id IS NULL THEN $2 ELSE a_id END,
             b_id = CASE WHEN a_id IS NOT NULL AND b_id IS NULL THEN $2 ELSE b_id END
         WHERE id = $1`,
        [bm.next_match_id, m.winnerId],
      );
    } else {
      await client.query(
        `UPDATE tournaments SET champion_id = $2, status = 'completed' WHERE id = $1`,
        [tournamentId, m.winnerId],
      );
    }
    await client.query(
      `INSERT INTO audit_log (id, actor, action, entity, entity_id, detail)
       VALUES ($1,'system','tournament.advance','tournament',$2,$3)`,
      ["au_" + rid(), tournamentId, `round ${bm.round}`],
    );
  });
}

/* -------------------------------------------------------------------- */
/*  helpers                                                            */
/* -------------------------------------------------------------------- */

export async function audit(
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  detail: string,
): Promise<void> {
  await query(
    `INSERT INTO audit_log (id, actor, action, entity, entity_id, detail)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    ["au_" + rid(), actor, action, entity, entityId, detail],
  );
}

export function rid(): string {
  return (
    globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ??
    Math.random().toString(36).slice(2, 14)
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || "player";
  let n = 1;
  while (
    await queryOne(`SELECT 1 FROM player_profiles WHERE slug = $1`, [slug])
  ) {
    slug = `${slugify(base)}-${++n}`;
  }
  return slug;
}

/* ==================================================================== */
/*  Accounts & auth                                                     */
/* ==================================================================== */

export interface AuthRow {
  id: string;
  slug: string;
  role: PlayerProfile["role"];
  passwordHash: string | null;
}

export async function getAuthByEmail(email: string): Promise<AuthRow | null> {
  const r = await queryOne<Row>(
    `SELECT id, slug, role, password_hash FROM player_profiles WHERE lower(email) = lower($1)`,
    [email],
  );
  return r
    ? {
        id: r.id as string,
        slug: r.slug as string,
        role: r.role as PlayerProfile["role"],
        passwordHash: (r.password_hash as string) ?? null,
      }
    : null;
}

export async function countPlayers(): Promise<number> {
  const [{ c }] = await query<{ c: number }>(
    `SELECT count(*)::int c FROM player_profiles`,
  );
  return c;
}

export interface NewAccount {
  fullName: string;
  nickname: string;
  email: string;
  passwordHash: string;
}

/** Self-service registration. The very first account becomes the admin. */
export async function createPlayerAccount(
  input: NewAccount,
): Promise<PlayerProfile> {
  const id = "p_" + rid();
  const slug = await uniqueSlug(input.nickname);
  let first = false;
  await transaction(async (client) => {
    // serialize concurrent registrations so exactly one account can be the
    // "first" (and become admin)
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cuepoint:first-account'))");
    const c = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM player_profiles`,
    );
    first = c.rows[0]?.n === "0";
    await client.query(
      `INSERT INTO player_profiles
        (id, slug, full_name, nickname, email, password_hash, role, membership_tier, membership_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'basic','active')`,
      [
        id,
        slug,
        input.fullName.trim(),
        input.nickname.trim(),
        input.email.trim().toLowerCase(),
        input.passwordHash,
        first ? "admin" : "player",
      ],
    );
    await client.query(
      `INSERT INTO user_memberships (id, player_id, plan_id, status)
       VALUES ($1,$2,'basic','active')`,
      ["um_" + id, id],
    );
  });
  await audit(
    slug,
    "account.register",
    "player",
    id,
    first ? "first account — granted admin" : "self-registered",
  );
  return (await getPlayerById(id))!;
}

export interface StaffNewPlayer {
  fullName: string;
  nickname: string;
  skillLevel?: PlayerProfile["skillLevel"];
  membershipTier?: PlayerProfile["membershipTier"];
  homeTable?: string | null;
  email?: string | null;
}

/** Staff creates a walk-in player account (no login). */
export async function createPlayerByStaff(
  input: StaffNewPlayer,
  actor: string,
): Promise<PlayerProfile> {
  const id = "p_" + rid();
  const slug = await uniqueSlug(input.nickname);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO player_profiles
        (id, slug, full_name, nickname, email, role, skill_level, home_table,
         membership_tier, membership_status)
       VALUES ($1,$2,$3,$4,$5,'player',$6,$7,$8,'active')`,
      [
        id,
        slug,
        input.fullName.trim(),
        input.nickname.trim(),
        input.email?.trim().toLowerCase() || null,
        input.skillLevel ?? "Rookie",
        input.homeTable ?? null,
        input.membershipTier ?? "basic",
      ],
    );
    await client.query(
      `INSERT INTO user_memberships (id, player_id, plan_id, status)
       VALUES ($1,$2,$3,'active')`,
      ["um_" + id, id, input.membershipTier ?? "basic"],
    );
  });
  await audit(actor, "player.create", "player", id, input.nickname);
  return (await getPlayerById(id))!;
}

export interface PlayerPatch {
  fullName?: string;
  skillLevel?: PlayerProfile["skillLevel"];
  membershipTier?: PlayerProfile["membershipTier"];
  role?: PlayerProfile["role"];
  bio?: string;
  homeTable?: string | null;
}

export async function updatePlayer(
  id: string,
  patch: PlayerPatch,
  actor: string,
): Promise<PlayerProfile | null> {
  const map: Record<string, string> = {
    fullName: "full_name",
    skillLevel: "skill_level",
    membershipTier: "membership_tier",
    role: "role",
    bio: "bio",
    homeTable: "home_table",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in patch && patch[k as keyof PlayerPatch] !== undefined) {
      params.push(patch[k as keyof PlayerPatch]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return getPlayerById(id).then((p) => p ?? null);
  params.push(id);
  await query(
    `UPDATE player_profiles SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params,
  );
  if (patch.membershipTier) {
    await query(
      `UPDATE user_memberships SET plan_id = $2 WHERE player_id = $1 AND status = 'active'`,
      [id, patch.membershipTier],
    );
  }
  await audit(actor, "player.update", "player", id, Object.keys(patch).join(","));
  return (await getPlayerById(id)) ?? null;
}

export async function adjustLoyalty(
  playerId: string,
  points: number,
  reason: string,
  actor: string,
): Promise<LoyaltyTransaction> {
  return addLoyaltyTransaction(
    {
      playerId,
      points,
      reason,
      source: "manual",
      referenceId: null,
      expiresAt: null,
    },
    actor,
  );
}

export async function getRankingHistory(
  playerId: string,
): Promise<{ points: number; at: string; reason: string }[]> {
  const rows = await query<Row>(
    `SELECT points, at, reason FROM ranking_history
     WHERE player_id = $1 ORDER BY at ASC`,
    [playerId],
  );
  return rows.map((r) => ({
    points: num(r.points),
    at: iso(r.at),
    reason: r.reason as string,
  }));
}

/* ==================================================================== */
/*  Staff: tournaments                                                  */
/* ==================================================================== */

export interface NewTournament {
  name: string;
  summary?: string;
  format?: Tournament["format"];
  startAt: string;
  registrationDeadline: string;
  entryFee?: number;
  prizePool?: number;
  maxPlayers?: number;
  venue?: string;
  rules?: string[];
  cover?: string;
}

export async function createTournament(
  input: NewTournament,
  actor: string,
): Promise<Tournament> {
  const id = "t_" + rid();
  let slug = slugify(input.name) || "tournament";
  let n = 1;
  while (await queryOne(`SELECT 1 FROM tournaments WHERE slug = $1`, [slug])) {
    slug = `${slugify(input.name)}-${++n}`;
  }
  const pool = input.prizePool ?? 0;
  await query(
    `INSERT INTO tournaments
      (id, slug, name, cover, summary, format, status, start_at,
       registration_deadline, entry_fee, prize_pool, prize_breakdown,
       max_players, venue, rules)
     VALUES ($1,$2,$3,$4,$5,$6,'registration_open',$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      slug,
      input.name.trim(),
      input.cover ?? "winter",
      input.summary ?? "",
      input.format ?? "single_elim",
      input.startAt,
      input.registrationDeadline,
      input.entryFee ?? 0,
      pool,
      JSON.stringify(
        pool > 0
          ? [
              { place: "Champion", amount: Math.round(pool * 0.55) },
              { place: "Runner-up", amount: Math.round(pool * 0.25) },
              { place: "Semi-finalists", amount: Math.round(pool * 0.1) },
            ]
          : [],
      ),
      input.maxPlayers ?? 8,
      input.venue ?? "Cue Point Pool Parlour, Pitipana",
      JSON.stringify(input.rules ?? []),
    ],
  );
  await audit(actor, "tournament.create", "tournament", id, input.name);
  return (await getTournamentBySlug(slug))!;
}

export async function setTournamentStatus(
  slug: string,
  status: TournamentStatus,
  actor: string,
): Promise<Tournament | undefined> {
  await query(`UPDATE tournaments SET status = $2 WHERE slug = $1`, [
    slug,
    status,
  ]);
  await audit(actor, "tournament.status", "tournament", slug, status);
  return getTournamentBySlug(slug);
}

const ROUND_NAMES: Record<number, string> = {
  1: "Round 1",
  2: "Quarter Final",
  3: "Semi Final",
  4: "Final",
};

function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round; // 0 = final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi Final";
  if (fromEnd === 2) return "Quarter Final";
  return ROUND_NAMES[round] ?? `Round ${round}`;
}

export interface BracketResult {
  ok: boolean;
  error?: string;
  tournament?: Tournament;
}

/**
 * Build a single-elimination bracket from the current registrations.
 * Supports 4 / 8 / 16 players (seeds them 1..n, standard bracket pairing).
 */
export async function generateBracket(
  slug: string,
  actor: string,
): Promise<BracketResult> {
  const t = await getTournamentBySlug(slug);
  if (!t) return { ok: false, error: "Tournament not found" };
  if (t.bracket.length)
    return { ok: false, error: "Bracket already generated" };

  const regs = t.registrations.filter((r) => r.playerId);
  const size = [4, 8, 16].reverse().find((s) => regs.length >= s) ?? 0;
  if (!size)
    return {
      ok: false,
      error: `Need at least 4 registered players (have ${regs.length})`,
    };

  // rank registrants by current ranking points for seeding
  const { stats } = await computeStats();
  const seeded = [...regs]
    .sort(
      (a, b) =>
        (stats.get(b.playerId!)?.rankingPoints ?? 0) -
        (stats.get(a.playerId!)?.rankingPoints ?? 0),
    )
    .slice(0, size)
    .map((r) => r.playerId!);

  // standard seed positions for a bracket of `size`
  const order = seedOrder(size); // e.g. [1,8,4,5,2,7,3,6] as 0-indexed
  const firstRound = order.map((i) => seeded[i]);

  const totalRounds = Math.log2(size);
  const nodes: {
    id: string;
    round: number;
    position: number;
    aId: string | null;
    bId: string | null;
    nextId: string | null;
  }[] = [];

  // build empty structure round by round
  const idsByRound: string[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const count = size / 2 ** round;
    const ids: string[] = [];
    for (let pos = 0; pos < count; pos++) {
      const id = `${slug}-r${round}-${pos}`;
      ids.push(id);
      nodes.push({ id, round, position: pos, aId: null, bId: null, nextId: null });
    }
    idsByRound.push(ids);
  }
  // link winners forward
  for (let round = 1; round < totalRounds; round++) {
    idsByRound[round - 1].forEach((id, pos) => {
      const node = nodes.find((n) => n.id === id)!;
      node.nextId = idsByRound[round][Math.floor(pos / 2)];
    });
  }
  // seed round 1
  idsByRound[0].forEach((id, pos) => {
    const node = nodes.find((n) => n.id === id)!;
    node.aId = firstRound[pos * 2] ?? null;
    node.bId = firstRound[pos * 2 + 1] ?? null;
  });

  const startAt = t.startAt;

  await transaction(async (client) => {
    // register seeds
    for (let i = 0; i < seeded.length; i++) {
      await client.query(
        `UPDATE tournament_registrations SET seed = $3
         WHERE tournament_id = $1 AND player_id = $2`,
        [t.id, seeded[i], i + 1],
      );
    }
    for (const node of nodes) {
      await client.query(
        `INSERT INTO tournament_matches
          (id, tournament_id, round, round_name, position, a_id, b_id,
           scheduled_at, table_name, next_match_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          node.id,
          t.id,
          node.round,
          roundLabel(node.round, totalRounds),
          node.position,
          node.aId,
          node.bId,
          startAt,
          `Table ${(node.position % 2) + 1}`,
          node.nextId,
        ],
      );
    }
    await client.query(
      `UPDATE tournaments SET status = 'live' WHERE id = $1`,
      [t.id],
    );
  });

  await audit(
    actor,
    "tournament.bracket",
    "tournament",
    t.id,
    `${size}-player single elimination`,
  );
  return { ok: true, tournament: await getTournamentBySlug(slug) };
}

/** 0-indexed seed positions for a single-elim bracket (1 v n, etc.) */
function seedOrder(size: number): number[] {
  let rounds = [0, 1];
  while (rounds.length < size) {
    const next: number[] = [];
    const total = rounds.length * 2 - 1;
    for (const r of rounds) {
      next.push(r);
      next.push(total - r);
    }
    rounds = next;
  }
  return rounds;
}

/* ==================================================================== */
/*  Staff: promotions                                                   */
/* ==================================================================== */

export interface PromotionInput {
  title: string;
  description?: string;
  type?: Promotion["type"];
  image?: string;
  startAt: string;
  endAt: string;
  eligibility?: string;
  discount: string;
  promoCode?: string | null;
  membershipRestriction?: Promotion["membershipRestriction"];
  usageNote?: string | null;
}

export async function createPromotion(
  input: PromotionInput,
  actor: string,
): Promise<Promotion> {
  const id = "promo_" + rid();
  let slug = slugify(input.title) || "offer";
  let n = 1;
  while (await queryOne(`SELECT 1 FROM promotions WHERE slug = $1`, [slug])) {
    slug = `${slugify(input.title)}-${++n}`;
  }
  await query(
    `INSERT INTO promotions
      (id, slug, title, description, type, image, start_at, end_at, eligibility,
       discount, promo_code, membership_restriction, usage_note, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')`,
    [
      id,
      slug,
      input.title.trim(),
      input.description ?? "",
      input.type ?? "limited",
      input.image ?? "navy",
      input.startAt,
      input.endAt,
      input.eligibility ?? "Everyone",
      input.discount,
      input.promoCode || null,
      input.membershipRestriction
        ? JSON.stringify(input.membershipRestriction)
        : null,
      input.usageNote || null,
    ],
  );
  await audit(actor, "promotion.create", "promotion", id, input.title);
  return mapPromotion(
    (await queryOne<Row>(`SELECT * FROM promotions WHERE id = $1`, [id]))!,
  );
}

export async function setPromotionStatus(
  id: string,
  status: "active" | "hidden",
  actor: string,
): Promise<void> {
  await query(`UPDATE promotions SET status = $2 WHERE id = $1`, [id, status]);
  await audit(actor, "promotion.status", "promotion", id, status);
}

export async function deletePromotion(id: string, actor: string): Promise<void> {
  await query(`DELETE FROM promotions WHERE id = $1`, [id]);
  await audit(actor, "promotion.delete", "promotion", id, "");
}

/* ==================================================================== */
/*  Staff: membership plans                                             */
/* ==================================================================== */

export async function updateMembershipPlan(
  id: MembershipPlan["id"],
  patch: Partial<
    Pick<
      MembershipPlan,
      "name" | "price" | "tagline" | "benefits" | "discountPct" | "loyaltyMultiplier" | "featured"
    >
  >,
  actor: string,
): Promise<MembershipPlan | null> {
  const map: Record<string, string> = {
    name: "name",
    price: "price",
    tagline: "tagline",
    discountPct: "discount_pct",
    loyaltyMultiplier: "loyalty_multiplier",
    featured: "featured",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) {
      params.push((patch as Record<string, unknown>)[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (patch.benefits) {
    params.push(JSON.stringify(patch.benefits));
    sets.push(`benefits = $${params.length}`);
  }
  if (!sets.length) return null;
  params.push(id);
  await query(
    `UPDATE membership_plans SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params,
  );
  await audit(actor, "membership.plan.update", "membership_plan", id, sets.join(","));
  const r = await queryOne<Row>(`SELECT * FROM membership_plans WHERE id = $1`, [
    id,
  ]);
  return r ? mapMembershipPlan(r) : null;
}
