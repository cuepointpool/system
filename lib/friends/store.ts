/* ============================================================
   Friend play — games & tournaments (raw SQL over Postgres).

   Rules of the road:
   · The database is the source of truth. Every mutation validates on
     the server, runs in ONE transaction, locks the parent row so
     concurrent joins can't over-fill, bumps `version`, writes the
     notifications, and ends with pg_notify() — delivered only on commit.
   · Views are built per viewer. A record you weren't added to doesn't
     exist as far as you're concerned (callers turn null into a 404).
   · A casual game and a tournament match are the same row type
     (friend_games); a 1v1 entrant is a team of one.
   ============================================================ */

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "../pg";
import { computeStats } from "../ecosystem/store";
import { generateBracket, nextPow2, roundName } from "./bracket";
import {
  FORMATS,
  isFormat,
  MIN_TEAMS_TO_START,
  TOURNAMENT_SIZES,
  requiredTournamentPlayers,
  type FormatCode,
} from "./formats";
import {
  FRIEND_POINTS,
  MAX_POINTED_GAMES_PER_ROSTER_PER_DAY,
  MAX_POINTED_TOURNAMENTS_PER_ROSTER_PER_DAY,
  rosterKey,
  type PointReason,
} from "./points";
import { CHANNEL } from "./realtime";
import type {
  BracketRound,
  FriendPointsSummary,
  GameListItem,
  GameStatus,
  GameView,
  GameViewer,
  MemberView,
  MyPlay,
  NotificationItem,
  PlayerRef,
  ResultStatus,
  TeamView,
  TournamentListItem,
  TournamentStatus,
  TournamentView,
  TournamentViewer,
} from "./types";
import { validateGameRoster, validateTeamSize } from "./validate";

/* -------------------------------------------------------------------- */
/*  Errors, actor, small helpers                                       */
/* -------------------------------------------------------------------- */

export class FriendsError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** who is asking. Staff/admin can moderate; only players can create/play. */
export interface Actor {
  id: string;
  role: "player" | "staff" | "admin";
  nickname: string;
}

const isMod = (a: Actor) => a.role !== "player";

const MAX_OPEN_GAMES_PER_ORGANIZER = 10;
const MAX_OPEN_TOURNAMENTS_PER_ORGANIZER = 5;

const nid = (prefix: string) =>
  `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));
const cleanName = (raw: unknown, fallback: string): string => {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return s || fallback;
};
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const gamePath = (id: string) => `/play/games/${id}`;
const tournamentPath = (id: string) => `/play/tournaments/${id}`;

type Db = <T extends object>(sql: string, params?: unknown[]) => Promise<T[]>;
const pooled: Db = (sql, params = []) => query(sql, params) as never;
const inTx =
  (c: PoolClient): Db =>
  async (sql, params = []) =>
    (await c.query(sql, params as never[])).rows as never;

/* -------------------------------------------------------------------- */
/*  Rows                                                               */
/* -------------------------------------------------------------------- */

interface GameRow {
  id: string;
  name: string;
  organizer_id: string;
  format: FormatCode;
  players_per_team: number;
  status: GameStatus;
  tournament_id: string | null;
  round: number | null;
  position: number | null;
  next_game_id: string | null;
  next_slot: "a" | "b" | null;
  is_bye: boolean;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  result_status: ResultStatus;
  reported_winner_team_id: string | null;
  reported_by: string | null;
  roster_key: string | null;
  points_awarded: boolean;
  version: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

interface TournamentRow {
  id: string;
  name: string;
  organizer_id: string;
  format: FormatCode;
  players_per_team: number;
  capacity_teams: number;
  seeding: "random" | "ranking";
  status: TournamentStatus;
  champion_team_id: string | null;
  roster_key: string | null;
  points_eligible: boolean;
  version: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

/* -------------------------------------------------------------------- */
/*  Event batch — notifications + the one NOTIFY per transaction       */
/* -------------------------------------------------------------------- */

class Batch {
  private topics = new Set<string>();
  constructor(private c: PoolClient) {}

  touch(...t: string[]) {
    for (const x of t) this.topics.add(x);
  }

  async notify(
    playerId: string,
    kind: string,
    message: string,
    href: string | null,
  ) {
    await this.c.query(
      `INSERT INTO friend_notifications (id, player_id, kind, message, href)
       VALUES ($1,$2,$3,$4,$5)`,
      [nid("fn"), playerId, kind, message, href],
    );
    this.topics.add(`user:${playerId}`);
  }

  async flush() {
    if (!this.topics.size) return;
    await this.c.query("SELECT pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify({ t: [...this.topics] }),
    ]);
  }
}

async function playersOfGame(c: PoolClient, gameId: string): Promise<string[]> {
  const rows = await inTx(c)<{ player_id: string }>(
    `SELECT player_id FROM friend_team_members WHERE game_id = $1`,
    [gameId],
  );
  return rows.map((r) => r.player_id);
}

async function playersOfTournament(
  c: PoolClient,
  tournamentId: string,
): Promise<string[]> {
  const rows = await inTx(c)<{ player_id: string }>(
    `SELECT player_id FROM friend_team_members WHERE tournament_id = $1`,
    [tournamentId],
  );
  return rows.map((r) => r.player_id);
}

/** signal everyone who can see this casual game */
async function touchGame(c: PoolClient, b: Batch, g: GameRow) {
  if (g.tournament_id) return touchTournament(c, b, g.tournament_id);
  b.touch(`game:${g.id}`, `user:${g.organizer_id}`);
  for (const p of await playersOfGame(c, g.id)) b.touch(`user:${p}`);
}

async function touchTournament(c: PoolClient, b: Batch, tournamentId: string) {
  const [t] = await inTx(c)<{ organizer_id: string }>(
    `SELECT organizer_id FROM friend_tournaments WHERE id = $1`,
    [tournamentId],
  );
  b.touch(`tournament:${tournamentId}`);
  if (t) b.touch(`user:${t.organizer_id}`);
  for (const p of await playersOfTournament(c, tournamentId)) b.touch(`user:${p}`);
}

/* -------------------------------------------------------------------- */
/*  Loading teams / players                                            */
/* -------------------------------------------------------------------- */

interface RawTeam {
  id: string;
  seed: number | null;
  members: MemberView[];
}

async function loadTeams(
  db: Db,
  where: { ids?: string[]; tournamentId?: string; gameId?: string },
): Promise<RawTeam[]> {
  const [clause, param] = where.ids
    ? ["t.id = ANY($1)", where.ids]
    : where.tournamentId
      ? ["t.tournament_id = $1", where.tournamentId]
      : ["t.game_id = $1", where.gameId];
  const rows = await db<{
    id: string;
    seed: number | null;
    player_id: string | null;
    status: "invited" | "accepted" | null;
    slug: string | null;
    nickname: string | null;
    avatar: string | null;
  }>(
    `SELECT t.id, t.seed, m.player_id, m.status, p.slug, p.nickname, p.avatar
       FROM friend_teams t
       LEFT JOIN friend_team_members m ON m.team_id = t.id
       LEFT JOIN player_profiles p ON p.id = m.player_id
      WHERE ${clause}
      ORDER BY t.created_at, t.id, m.created_at`,
    [param],
  );
  const out = new Map<string, RawTeam>();
  for (const r of rows) {
    let team = out.get(r.id);
    if (!team) out.set(r.id, (team = { id: r.id, seed: r.seed, members: [] }));
    if (r.player_id && r.status) {
      team.members.push({
        id: r.player_id,
        slug: r.slug ?? "",
        nickname: r.nickname ?? "Player",
        avatar: r.avatar,
        status: r.status,
      });
    }
  }
  return [...out.values()];
}

function toTeamView(t: RawTeam, playersPerTeam: number): TeamView {
  return {
    id: t.id,
    name: t.members.length ? t.members.map((m) => m.nickname).join(" & ") : "Empty team",
    seed: t.seed,
    members: t.members,
    complete:
      t.members.length === playersPerTeam &&
      t.members.every((m) => m.status === "accepted"),
  };
}

async function loadPlayerRefs(db: Db, ids: string[]): Promise<Map<string, PlayerRef>> {
  const out = new Map<string, PlayerRef>();
  if (!ids.length) return out;
  const rows = await db<PlayerRef>(
    `SELECT id, slug, nickname, avatar FROM player_profiles WHERE id = ANY($1)`,
    [ids],
  );
  for (const r of rows) out.set(r.id, r);
  return out;
}

const GHOST: PlayerRef = { id: "", slug: "", nickname: "Player", avatar: null };

/* -------------------------------------------------------------------- */
/*  View builders                                                      */
/* -------------------------------------------------------------------- */

/**
 * Turn game rows into views for ONE viewer. Games the viewer isn't allowed to
 * see are dropped, so callers get "not found" rather than "forbidden".
 */
async function gameViews(
  db: Db,
  rows: GameRow[],
  actor: Actor,
  preloaded?: { teams?: Map<string, RawTeam> },
): Promise<GameView[]> {
  if (!rows.length) return [];

  const teamIds = uniq(
    rows.flatMap((g) => [g.team_a_id, g.team_b_id]).filter((x): x is string => !!x),
  );
  const teams =
    preloaded?.teams ??
    new Map((await loadTeams(db, { ids: teamIds })).map((t) => [t.id, t]));

  const people = await loadPlayerRefs(
    db,
    uniq(
      rows.flatMap((g) => [g.organizer_id, g.reported_by]).filter((x): x is string => !!x),
    ),
  );

  const tournamentIds = uniq(rows.map((g) => g.tournament_id).filter((x): x is string => !!x));
  const tournamentNames = new Map<string, string>();
  const totalRounds = new Map<string, number>();
  const viewerTournaments = new Set<string>();
  if (tournamentIds.length) {
    for (const t of await db<{ id: string; name: string }>(
      `SELECT id, name FROM friend_tournaments WHERE id = ANY($1)`,
      [tournamentIds],
    ))
      tournamentNames.set(t.id, t.name);
    for (const r of await db<{ tournament_id: string; rounds: number }>(
      `SELECT tournament_id, max(round)::int AS rounds FROM friend_games
        WHERE tournament_id = ANY($1) GROUP BY tournament_id`,
      [tournamentIds],
    ))
      totalRounds.set(r.tournament_id, r.rounds);
    for (const r of await db<{ tid: string }>(
      `SELECT tournament_id AS tid FROM friend_team_members
        WHERE player_id = $1 AND tournament_id = ANY($2)
       UNION
       SELECT id FROM friend_tournaments WHERE organizer_id = $1 AND id = ANY($2)`,
      [actor.id, tournamentIds],
    ))
      viewerTournaments.add(r.tid);
  }

  const out: GameView[] = [];
  for (const g of rows) {
    const ta = g.team_a_id ? teams.get(g.team_a_id) : undefined;
    const tb = g.team_b_id ? teams.get(g.team_b_id) : undefined;
    const teamA = ta ? toTeamView(ta, g.players_per_team) : null;
    const teamB = tb ? toTeamView(tb, g.players_per_team) : null;

    const isOrganizer = g.organizer_id === actor.id;
    const mine = [teamA, teamB].find((t) => t?.members.some((m) => m.id === actor.id)) ?? null;
    const myMember = mine?.members.find((m) => m.id === actor.id) ?? null;
    const isPlayer = myMember?.status === "accepted";
    const invited = myMember?.status === "invited";

    const canSee =
      isOrganizer ||
      !!myMember ||
      isMod(actor) ||
      (!!g.tournament_id && viewerTournaments.has(g.tournament_id));
    if (!canSee) continue;

    const inTournament = !!g.tournament_id;
    const open = g.status === "ready" || g.status === "in_progress";
    const beforeStart = g.status === "waiting_for_players" || g.status === "ready";
    const reporterTeam = g.reported_by
      ? ([teamA, teamB].find((t) => t?.members.some((m) => m.id === g.reported_by)) ?? null)
      : null;
    const canAnswer =
      g.result_status === "reported" &&
      isPlayer &&
      !!mine &&
      !!reporterTeam &&
      mine.id !== reporterTeam.id;

    const viewer: GameViewer = {
      isOrganizer,
      isPlayer,
      teamId: mine?.id ?? null,
      invited,
      canStart: g.status === "ready" && (isPlayer || isOrganizer || isMod(actor)),
      canReport: open && isPlayer && !g.is_bye && g.result_status !== "reported",
      canConfirm: canAnswer,
      canDispute: canAnswer,
      canSettle: open && !!teamA && !!teamB && (isOrganizer || isMod(actor)),
      canCancel:
        !inTournament &&
        (isOrganizer || isMod(actor)) &&
        (beforeStart || g.status === "in_progress"),
      canManage: !inTournament && isOrganizer && beforeStart,
      canLeave: !inTournament && (isPlayer || invited) && !isOrganizer && beforeStart,
    };

    const total = g.tournament_id ? (totalRounds.get(g.tournament_id) ?? g.round ?? 1) : 0;
    const accepted =
      (teamA?.members.filter((m) => m.status === "accepted").length ?? 0) +
      (teamB?.members.filter((m) => m.status === "accepted").length ?? 0);

    out.push({
      id: g.id,
      name: g.name,
      format: g.format,
      playersPerTeam: g.players_per_team,
      requiredPlayers: g.players_per_team * 2,
      joined: accepted,
      status: g.status,
      organizer: people.get(g.organizer_id) ?? GHOST,
      teamA,
      teamB,
      winnerTeamId: g.winner_team_id,
      resultStatus: g.result_status,
      reportedWinnerTeamId: g.reported_winner_team_id,
      reportedBy: g.reported_by ? (people.get(g.reported_by) ?? null) : null,
      tournament: g.tournament_id
        ? { id: g.tournament_id, name: tournamentNames.get(g.tournament_id) ?? "" }
        : null,
      round: g.round,
      roundName: g.round && total ? roundName(g.round, total) : null,
      position: g.position,
      isBye: g.is_bye,
      version: g.version,
      createdAt: iso(g.created_at),
      startedAt: isoOrNull(g.started_at),
      completedAt: isoOrNull(g.completed_at),
      viewer,
    });
  }
  return out;
}

export async function getGameView(id: string, actor: Actor): Promise<GameView | null> {
  const rows = await pooled<GameRow>(`SELECT * FROM friend_games WHERE id = $1`, [id]);
  return (await gameViews(pooled, rows, actor))[0] ?? null;
}

export async function getTournamentView(
  id: string,
  actor: Actor,
): Promise<TournamentView | null> {
  const [t] = await pooled<TournamentRow>(
    `SELECT * FROM friend_tournaments WHERE id = $1`,
    [id],
  );
  if (!t) return null;

  const rawTeams = await loadTeams(pooled, { tournamentId: id });
  const teams = rawTeams.map((r) => toTeamView(r, t.players_per_team));
  const isOrganizer = t.organizer_id === actor.id;
  const myTeam = teams.find((x) => x.members.some((m) => m.id === actor.id)) ?? null;
  const myMember = myTeam?.members.find((m) => m.id === actor.id) ?? null;
  if (!isOrganizer && !myMember && !isMod(actor)) return null;

  const gameRows = await pooled<GameRow>(
    `SELECT * FROM friend_games WHERE tournament_id = $1 ORDER BY round, position`,
    [id],
  );
  const games = await gameViews(pooled, gameRows, actor, {
    teams: new Map(rawTeams.map((r) => [r.id, r])),
  });

  const totalRounds = games.reduce((m, g) => Math.max(m, g.round ?? 0), 0);
  const rounds: BracketRound[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      round: r,
      name: roundName(r, totalRounds),
      games: games.filter((g) => g.round === r),
    });
  }

  const byId = new Map(teams.map((x) => [x.id, x]));
  const champion = t.champion_team_id ? (byId.get(t.champion_team_id) ?? null) : null;
  const finalGame = games.find((g) => g.round === totalRounds);
  const runnerUpId =
    finalGame && finalGame.status === "completed" && finalGame.winnerTeamId
      ? finalGame.teamA?.id === finalGame.winnerTeamId
        ? finalGame.teamB?.id
        : finalGame.teamA?.id
      : null;

  const open = t.status === "registration_open";
  const viewer: TournamentViewer = {
    isOrganizer,
    isMember: myMember?.status === "accepted",
    invited: myMember?.status === "invited",
    teamId: myTeam?.id ?? null,
    canManage: open && isOrganizer,
    canStart: open && isOrganizer,
    canCancel: (open || t.status === "in_progress") && (isOrganizer || isMod(actor)),
    canLeave: open && !!myMember,
  };

  const [org] = [...(await loadPlayerRefs(pooled, [t.organizer_id])).values()];
  return {
    id: t.id,
    name: t.name,
    format: t.format,
    playersPerTeam: t.players_per_team,
    capacityTeams: t.capacity_teams,
    requiredPlayers: t.players_per_team * t.capacity_teams,
    seeding: t.seeding,
    status: t.status,
    organizer: org ?? GHOST,
    teams,
    teamsComplete: teams.filter((x) => x.complete).length,
    playersJoined: teams.reduce(
      (n, x) => n + x.members.filter((m) => m.status === "accepted").length,
      0,
    ),
    rounds,
    byes: games.filter((g) => g.isBye).length,
    champion,
    runnerUp: runnerUpId ? (byId.get(runnerUpId) ?? null) : null,
    version: t.version,
    createdAt: iso(t.created_at),
    startedAt: isoOrNull(t.started_at),
    completedAt: isoOrNull(t.completed_at),
    viewer,
  };
}

/* -------------------------------------------------------------------- */
/*  Lists, points, notifications, search                               */
/* -------------------------------------------------------------------- */

export async function getFriendPoints(playerId: string): Promise<FriendPointsSummary> {
  const [tot] = await pooled<{ total: number }>(
    `SELECT COALESCE(sum(points),0)::int AS total FROM friend_points WHERE player_id = $1`,
    [playerId],
  );
  const total = tot?.total ?? 0;
  const [played] = await pooled<{ played: number; wins: number }>(
    `SELECT count(*)::int AS played,
            (count(*) FILTER (WHERE m.team_id = g.winner_team_id))::int AS wins
       FROM friend_games g
       JOIN friend_team_members m
         ON m.player_id = $1 AND m.team_id IN (g.team_a_id, g.team_b_id)
      WHERE g.status = 'completed' AND g.is_bye = false`,
    [playerId],
  );
  const [won] = await pooled<{ n: number }>(
    `SELECT count(*)::int AS n FROM friend_tournaments t
       JOIN friend_team_members m ON m.team_id = t.champion_team_id AND m.player_id = $1
      WHERE t.status = 'completed'`,
    [playerId],
  );
  let rank: number | null = null;
  if (total > 0) {
    const [r] = await pooled<{ ahead: number }>(
      `SELECT count(*)::int AS ahead FROM (
         SELECT player_id FROM friend_points GROUP BY player_id HAVING sum(points) > $1
       ) x`,
      [total],
    );
    rank = (r?.ahead ?? 0) + 1;
  }
  const recent = await pooled<{ points: number; reason: string; created_at: Date }>(
    `SELECT points, reason, created_at FROM friend_points
      WHERE player_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [playerId],
  );
  return {
    total,
    rank,
    gamesPlayed: played?.played ?? 0,
    wins: played?.wins ?? 0,
    tournamentsWon: won?.n ?? 0,
    recent: recent.map((r) => ({ points: r.points, reason: r.reason, at: iso(r.created_at) })),
  };
}

export async function unreadCount(playerId: string): Promise<number> {
  const [r] = await pooled<{ n: number }>(
    `SELECT count(*)::int AS n FROM friend_notifications
      WHERE player_id = $1 AND read_at IS NULL`,
    [playerId],
  );
  return r?.n ?? 0;
}

export async function listMyPlay(actor: Actor): Promise<MyPlay> {
  const gameRows = await pooled<GameRow>(
    `SELECT g.* FROM friend_games g
      WHERE g.tournament_id IS NULL
        AND (g.organizer_id = $1
             OR EXISTS (SELECT 1 FROM friend_team_members m
                         WHERE m.game_id = g.id AND m.player_id = $1))
      ORDER BY (g.status IN ('completed','cancelled')), g.created_at DESC
      LIMIT 100`,
    [actor.id],
  );
  const games: GameListItem[] = (await gameViews(pooled, gameRows, actor)).map((g) => {
    const winner = [g.teamA, g.teamB].find((t) => t?.id === g.winnerTeamId);
    return {
      id: g.id,
      name: g.name,
      format: g.format,
      status: g.status,
      joined: g.joined,
      requiredPlayers: g.requiredPlayers,
      organizer: g.organizer,
      invited: g.viewer.invited,
      won:
        g.status === "completed" && g.viewer.teamId && !g.isBye
          ? winner?.id === g.viewer.teamId
          : null,
      createdAt: g.createdAt,
      version: g.version,
    };
  });

  const tRows = await pooled<
    TournamentRow & {
      teams: number;
      teams_complete: number;
      players_joined: number;
      invited: boolean;
      next_game_id: string | null;
    }
  >(
    `SELECT t.*,
       (SELECT count(*) FROM friend_teams ft WHERE ft.tournament_id = t.id)::int AS teams,
       (SELECT count(*) FROM friend_teams ft
         WHERE ft.tournament_id = t.id
           AND (SELECT count(*) FROM friend_team_members m
                 WHERE m.team_id = ft.id AND m.status = 'accepted') = t.players_per_team)::int AS teams_complete,
       (SELECT count(*) FROM friend_team_members m
         WHERE m.tournament_id = t.id AND m.status = 'accepted')::int AS players_joined,
       EXISTS (SELECT 1 FROM friend_team_members m
                WHERE m.tournament_id = t.id AND m.player_id = $1 AND m.status = 'invited') AS invited,
       (SELECT g.id FROM friend_games g
          JOIN friend_team_members m
            ON m.player_id = $1 AND m.tournament_id = t.id
           AND m.status = 'accepted' AND m.team_id IN (g.team_a_id, g.team_b_id)
         WHERE g.tournament_id = t.id AND g.status IN ('ready','in_progress')
         ORDER BY g.round LIMIT 1) AS next_game_id
       FROM friend_tournaments t
      WHERE t.organizer_id = $1
         OR EXISTS (SELECT 1 FROM friend_team_members m
                     WHERE m.tournament_id = t.id AND m.player_id = $1)
      ORDER BY (t.status IN ('completed','cancelled')), t.created_at DESC
      LIMIT 100`,
    [actor.id],
  );
  const orgs = await loadPlayerRefs(pooled, uniq(tRows.map((t) => t.organizer_id)));
  const tournaments: TournamentListItem[] = tRows.map((t) => ({
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    capacityTeams: t.capacity_teams,
    teams: t.teams,
    teamsComplete: t.teams_complete,
    playersJoined: t.players_joined,
    requiredPlayers: t.players_per_team * t.capacity_teams,
    organizer: orgs.get(t.organizer_id) ?? GHOST,
    invited: t.invited,
    nextGameId: t.next_game_id,
    createdAt: iso(t.created_at),
    version: t.version,
  }));

  const [points, unread] = await Promise.all([
    getFriendPoints(actor.id),
    unreadCount(actor.id),
  ]);
  return { games, tournaments, points, unread };
}

export async function listNotifications(
  playerId: string,
  limit = 30,
): Promise<{ unread: number; items: NotificationItem[] }> {
  const rows = await pooled<{
    id: string;
    kind: string;
    message: string;
    href: string | null;
    read_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, kind, message, href, read_at, created_at FROM friend_notifications
      WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [playerId, limit],
  );
  return {
    unread: await unreadCount(playerId),
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      href: r.href,
      read: !!r.read_at,
      createdAt: iso(r.created_at),
    })),
  };
}

export async function markNotificationsRead(playerId: string, ids?: string[]) {
  await transaction(async (c) => {
    await c.query(
      `UPDATE friend_notifications SET read_at = now()
        WHERE player_id = $1 AND read_at IS NULL
          AND ($2::text[] IS NULL OR id = ANY($2))`,
      [playerId, ids && ids.length ? ids : null],
    );
    // other tabs / devices refresh their badge
    await c.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify({ t: [`user:${playerId}`] })]);
  });
}

export interface PlayerHit {
  id: string;
  slug: string;
  nickname: string;
  avatar: string | null;
  isYou: boolean;
}

/** Registered players by nickname or handle. Never exposes email or real name. */
export async function searchPlayers(actor: Actor, q: string): Promise<PlayerHit[]> {
  const term = q.trim().slice(0, 40);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await pooled<PlayerRef>(
    `SELECT id, slug, nickname, avatar FROM player_profiles
      WHERE role = 'player' AND (nickname ILIKE $1 OR slug ILIKE $1)
      ORDER BY (lower(nickname) = lower($2)) DESC, nickname LIMIT 8`,
    [like, term],
  );
  return rows.map((r) => ({ ...r, isYou: r.id === actor.id }));
}

/* -------------------------------------------------------------------- */
/*  Realtime authorisation                                             */
/* -------------------------------------------------------------------- */

/** may this viewer listen to `topic`? (called once per topic when a stream opens) */
export async function canSubscribe(actor: Actor, topic: string): Promise<boolean> {
  const [kind, id] = topic.split(":");
  if (!id) return false;
  if (kind === "user") return id === actor.id;
  if (isMod(actor)) return kind === "game" || kind === "tournament";
  if (kind === "game") {
    const rows = await pooled<{ ok: number }>(
      `SELECT 1 AS ok FROM friend_games g
        WHERE g.id = $1
          AND (g.organizer_id = $2
               OR EXISTS (SELECT 1 FROM friend_team_members m
                           WHERE m.game_id = g.id AND m.player_id = $2))`,
      [id, actor.id],
    );
    return rows.length > 0;
  }
  if (kind === "tournament") {
    const rows = await pooled<{ ok: number }>(
      `SELECT 1 AS ok FROM friend_tournaments t
        WHERE t.id = $1
          AND (t.organizer_id = $2
               OR EXISTS (SELECT 1 FROM friend_team_members m
                           WHERE m.tournament_id = t.id AND m.player_id = $2))`,
      [id, actor.id],
    );
    return rows.length > 0;
  }
  return false;
}

/* -------------------------------------------------------------------- */
/*  Locking + shared write helpers                                     */
/* -------------------------------------------------------------------- */

/** Lock order is always tournament → game, so two writers can't deadlock. */
async function lockGame(c: PoolClient, id: string): Promise<GameRow> {
  const pre = await c.query<{ tournament_id: string | null }>(
    `SELECT tournament_id FROM friend_games WHERE id = $1`,
    [id],
  );
  if (!pre.rows[0]) throw new FriendsError(404, "Game not found");
  if (pre.rows[0].tournament_id) {
    await c.query(`SELECT 1 FROM friend_tournaments WHERE id = $1 FOR UPDATE`, [
      pre.rows[0].tournament_id,
    ]);
  }
  const r = await c.query<GameRow>(`SELECT * FROM friend_games WHERE id = $1 FOR UPDATE`, [id]);
  if (!r.rows[0]) throw new FriendsError(404, "Game not found");
  return r.rows[0];
}

async function lockTournament(c: PoolClient, id: string): Promise<TournamentRow> {
  const r = await c.query<TournamentRow>(
    `SELECT * FROM friend_tournaments WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (!r.rows[0]) throw new FriendsError(404, "Tournament not found");
  return r.rows[0];
}

async function bumpGame(c: PoolClient, id: string) {
  await c.query(`UPDATE friend_games SET version = version + 1 WHERE id = $1`, [id]);
}
async function bumpTournament(c: PoolClient, id: string) {
  await c.query(`UPDATE friend_tournaments SET version = version + 1 WHERE id = $1`, [id]);
}

async function teamName(c: PoolClient, teamId: string | null): Promise<string> {
  if (!teamId) return "TBD";
  const rows = await inTx(c)<{ nickname: string }>(
    `SELECT p.nickname FROM friend_team_members m
       JOIN player_profiles p ON p.id = m.player_id
      WHERE m.team_id = $1 ORDER BY m.created_at`,
    [teamId],
  );
  return rows.map((r) => r.nickname).join(" & ") || "TBD";
}

async function teamPlayerIds(c: PoolClient, teamId: string | null): Promise<string[]> {
  if (!teamId) return [];
  const rows = await inTx(c)<{ player_id: string }>(
    `SELECT player_id FROM friend_team_members WHERE team_id = $1 AND status = 'accepted'`,
    [teamId],
  );
  return rows.map((r) => r.player_id);
}

/** Flip a casual game between waiting_for_players and ready, from the seats. */
async function syncGameStatus(c: PoolClient, g: GameRow): Promise<GameStatus> {
  const rows = await inTx(c)<{ accepted: number; total: number }>(
    `SELECT (count(m.*) FILTER (WHERE m.status = 'accepted'))::int AS accepted,
            count(m.*)::int AS total
       FROM friend_teams t
       LEFT JOIN friend_team_members m ON m.team_id = t.id
      WHERE t.game_id = $1 GROUP BY t.id`,
    [g.id],
  );
  const full =
    rows.length === 2 &&
    rows.every((r) => r.accepted === g.players_per_team && r.total === g.players_per_team);
  const next: GameStatus = full ? "ready" : "waiting_for_players";
  if (g.status === "waiting_for_players" || g.status === "ready") {
    await c.query(`UPDATE friend_games SET status = $2 WHERE id = $1`, [g.id, next]);
    return next;
  }
  return g.status;
}

async function existingPlayers(c: PoolClient, ids: string[]): Promise<Map<string, string>> {
  const rows = await inTx(c)<{ id: string; nickname: string }>(
    `SELECT id, nickname FROM player_profiles WHERE id = ANY($1) AND role = 'player'`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r.nickname]));
}

/* ==================================================================== */
/*  CASUAL GAMES                                                       */
/* ==================================================================== */

export async function createGame(
  actor: Actor,
  input: { name?: string; format: unknown; teamA: string[]; teamB: string[] },
): Promise<string> {
  if (actor.role !== "player") throw new FriendsError(403, "Only players can create games.");
  if (!isFormat(input.format)) throw new FriendsError(400, "Choose 1v1 or 2v2.");
  const f = FORMATS[input.format];
  const a = uniq(input.teamA ?? []);
  const b = uniq(input.teamB ?? []);
  const all = [...a, ...b];
  if (uniq(all).length !== all.length)
    throw new FriendsError(400, "A player can only be on one team.");

  const roster = validateGameRoster(f, all.length);
  if (roster.state !== "ok") throw new FriendsError(400, roster.message, { roster });
  for (const size of [a.length, b.length]) {
    const err = validateTeamSize(f, size);
    if (err) throw new FriendsError(400, err);
  }
  if (!all.includes(actor.id))
    throw new FriendsError(400, "You must be one of the players in your own game.");

  return transaction(async (c) => {
    const [open] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_games
        WHERE organizer_id = $1 AND tournament_id IS NULL
          AND status IN ('waiting_for_players','ready','in_progress')`,
      [actor.id],
    );
    if ((open?.n ?? 0) >= MAX_OPEN_GAMES_PER_ORGANIZER)
      throw new FriendsError(
        400,
        `You already have ${MAX_OPEN_GAMES_PER_ORGANIZER} unfinished games. Finish or cancel one first.`,
      );

    const known = await existingPlayers(c, all);
    if (known.size !== all.length)
      throw new FriendsError(400, "One of the selected players could not be found.");

    const gameId = nid("fg");
    const name = cleanName(input.name, `${actor.nickname}'s ${f.code} game`);
    await c.query(
      `INSERT INTO friend_games (id, name, organizer_id, format, players_per_team)
       VALUES ($1,$2,$3,$4,$5)`,
      [gameId, name, actor.id, f.code, f.playersPerTeam],
    );
    const batch = new Batch(c);
    const slots: [string, string[]][] = [
      ["a", a],
      ["b", b],
    ];
    const teamIds: Record<string, string> = {};
    for (const [slot, members] of slots) {
      const teamId = nid("ft");
      teamIds[slot] = teamId;
      await c.query(
        `INSERT INTO friend_teams (id, game_id, slot) VALUES ($1,$2,$3)`,
        [teamId, gameId, slot],
      );
      for (const pid of members) {
        const self = pid === actor.id;
        await c.query(
          `INSERT INTO friend_team_members
             (team_id, player_id, game_id, status, invited_by, responded_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [teamId, pid, gameId, self ? "accepted" : "invited", actor.id, self ? new Date() : null],
        );
        if (!self)
          await batch.notify(
            pid,
            "game_invite",
            `${actor.nickname} invited you to ${name} (${f.code}).`,
            gamePath(gameId),
          );
      }
    }
    await c.query(`UPDATE friend_games SET team_a_id = $2, team_b_id = $3 WHERE id = $1`, [
      gameId,
      teamIds.a,
      teamIds.b,
    ]);
    const [g] = await inTx(c)<GameRow>(`SELECT * FROM friend_games WHERE id = $1`, [gameId]);
    await syncGameStatus(c, g);
    await touchGame(c, batch, g);
    await batch.flush();
    return gameId;
  });
}

/** accept / decline an invitation, or leave (accept=false) before the game starts */
export async function respondToGame(gameId: string, actor: Actor, accept: boolean) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.tournament_id) throw new FriendsError(400, "Respond from the tournament page.");
    if (g.status !== "waiting_for_players" && g.status !== "ready")
      throw new FriendsError(409, "This game has already started or finished.");
    const [m] = await inTx(c)<{ team_id: string; status: string }>(
      `SELECT team_id, status FROM friend_team_members WHERE game_id = $1 AND player_id = $2`,
      [gameId, actor.id],
    );
    if (!m) throw new FriendsError(404, "You are not in this game.");
    const batch = new Batch(c);

    if (accept) {
      if (m.status === "invited") {
        await c.query(
          `UPDATE friend_team_members SET status = 'accepted', responded_at = now()
            WHERE game_id = $1 AND player_id = $2`,
          [gameId, actor.id],
        );
      }
    } else {
      if (g.organizer_id === actor.id)
        throw new FriendsError(400, "Organizers cancel the game instead of leaving it.");
      await c.query(`DELETE FROM friend_team_members WHERE game_id = $1 AND player_id = $2`, [
        gameId,
        actor.id,
      ]);
    }
    const before = g.status;
    const after = await syncGameStatus(c, g);
    await bumpGame(c, gameId);
    const [{ n }] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_team_members WHERE game_id = $1 AND status = 'accepted'`,
      [gameId],
    );
    const need = g.players_per_team * 2;
    if (g.organizer_id !== actor.id) {
      await batch.notify(
        g.organizer_id,
        accept ? "invite_accepted" : "invite_declined",
        accept
          ? `${actor.nickname} accepted — ${g.name} (${n}/${need}).`
          : `${actor.nickname} can't play in ${g.name}. Add someone else.`,
        gamePath(gameId),
      );
    }
    if (before !== "ready" && after === "ready") {
      for (const pid of await playersOfGame(c, gameId))
        if (pid !== g.organizer_id)
          await batch.notify(pid, "game_ready", `${g.name} is ready to start.`, gamePath(gameId));
      await batch.notify(g.organizer_id, "game_ready", `${g.name} is ready to start.`, gamePath(gameId));
    }
    await touchGame(c, batch, g);
    batch.touch(`user:${actor.id}`);
    await batch.flush();
  });
}

/** organizer adds a registered player into an open seat */
export async function addPlayerToGame(
  gameId: string,
  actor: Actor,
  playerId: string,
  teamId?: string,
) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.tournament_id) throw new FriendsError(400, "Manage teams from the tournament page.");
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can add players.");
    if (g.status !== "waiting_for_players" && g.status !== "ready")
      throw new FriendsError(409, "This game has already started.");
    const known = await existingPlayers(c, [playerId]);
    if (!known.has(playerId)) throw new FriendsError(400, "That player could not be found.");
    const nickname = known.get(playerId)!;

    const seats = await inTx(c)<{ id: string; n: number }>(
      `SELECT t.id, count(m.*)::int AS n FROM friend_teams t
         LEFT JOIN friend_team_members m ON m.team_id = t.id
        WHERE t.game_id = $1 GROUP BY t.id ORDER BY t.slot`,
      [gameId],
    );
    const target = teamId
      ? seats.find((s) => s.id === teamId)
      : seats.find((s) => s.n < g.players_per_team);
    if (!target || target.n >= g.players_per_team)
      throw new FriendsError(
        409,
        `${g.format} requires exactly ${g.players_per_team * 2} players — there is no free seat.`,
      );
    try {
      await c.query(
        `INSERT INTO friend_team_members (team_id, player_id, game_id, status, invited_by)
         VALUES ($1,$2,$3,'invited',$4)`,
        [target.id, playerId, gameId, actor.id],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505")
        throw new FriendsError(409, `${nickname} is already in this game.`);
      throw err;
    }
    await syncGameStatus(c, g);
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    await batch.notify(
      playerId,
      "game_invite",
      `${actor.nickname} invited you to ${g.name} (${g.format}).`,
      gamePath(gameId),
    );
    await touchGame(c, batch, g);
    await batch.flush();
  });
}

export async function removePlayerFromGame(gameId: string, actor: Actor, playerId: string) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.tournament_id) throw new FriendsError(400, "Manage teams from the tournament page.");
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can remove players.");
    if (playerId === g.organizer_id)
      throw new FriendsError(400, "The organizer can't be removed. Cancel the game instead.");
    if (g.status !== "waiting_for_players" && g.status !== "ready")
      throw new FriendsError(409, "This game has already started.");
    const res = await c.query(
      `DELETE FROM friend_team_members WHERE game_id = $1 AND player_id = $2`,
      [gameId, playerId],
    );
    if (!res.rowCount) throw new FriendsError(404, "That player is not in this game.");
    await syncGameStatus(c, g);
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    await batch.notify(playerId, "removed", `You were removed from ${g.name}.`, null);
    await touchGame(c, batch, g);
    batch.touch(`user:${playerId}`);
    await batch.flush();
  });
}

export async function startGame(gameId: string, actor: Actor) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    const involved = !!(await mySide(c, g, actor.id)) || g.organizer_id === actor.id || isMod(actor);
    if (!involved) throw new FriendsError(403, "Only the players can start this game.");
    if (g.status !== "ready")
      throw new FriendsError(409, "Everyone has to accept before the game can start.");
    await c.query(
      `UPDATE friend_games SET status = 'in_progress', started_at = now() WHERE id = $1`,
      [gameId],
    );
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    const pids = g.tournament_id
      ? [...(await teamPlayerIds(c, g.team_a_id)), ...(await teamPlayerIds(c, g.team_b_id))]
      : await playersOfGame(c, gameId);
    for (const pid of uniq(pids))
      if (pid !== actor.id)
        await batch.notify(
          pid,
          "game_started",
          `${g.name} has started.`,
          g.tournament_id ? tournamentPath(g.tournament_id) : gamePath(gameId),
        );
    await touchGame(c, batch, g);
    if (g.tournament_id) await bumpTournament(c, g.tournament_id);
    await batch.flush();
  });
}

export async function cancelGame(gameId: string, actor: Actor) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.tournament_id) throw new FriendsError(400, "Cancel the tournament instead.");
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can cancel this game.");
    if (g.status === "completed" || g.status === "cancelled")
      throw new FriendsError(409, "This game is already finished.");
    await c.query(`UPDATE friend_games SET status = 'cancelled' WHERE id = $1`, [gameId]);
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    for (const pid of await playersOfGame(c, gameId))
      if (pid !== actor.id)
        await batch.notify(pid, "game_cancelled", `${g.name} was cancelled.`, gamePath(gameId));
    await touchGame(c, batch, g);
    await batch.flush();
  });
}

/* ---------------------------- results ---------------------------- */

/** one player reports who won; the other side confirms */
export async function reportResult(gameId: string, actor: Actor, winnerTeamId: string) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.status !== "ready" && g.status !== "in_progress")
      throw new FriendsError(409, "This game isn't in play.");
    if (g.is_bye) throw new FriendsError(400, "A BYE has no result to report.");
    if (g.result_status === "reported")
      throw new FriendsError(409, "A result is already waiting for confirmation.");
    const mine = await mySide(c, g, actor.id);
    if (!mine) throw new FriendsError(403, "Only the players in this game can report the result.");
    if (winnerTeamId !== g.team_a_id && winnerTeamId !== g.team_b_id)
      throw new FriendsError(400, "Pick one of the two sides as the winner.");

    await c.query(
      `UPDATE friend_games
          SET result_status = 'reported', reported_winner_team_id = $2, reported_by = $3,
              status = 'in_progress', started_at = COALESCE(started_at, now())
        WHERE id = $1`,
      [gameId, winnerTeamId, actor.id],
    );
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    const winName = await teamName(c, winnerTeamId);
    const otherTeam = mine === g.team_a_id ? g.team_b_id : g.team_a_id;
    const href = g.tournament_id ? tournamentPath(g.tournament_id) : gamePath(gameId);
    for (const pid of await teamPlayerIds(c, otherTeam))
      await batch.notify(
        pid,
        "result_reported",
        `${actor.nickname} says ${winName} won ${g.name}. Please confirm or dispute.`,
        href,
      );
    await touchGame(c, batch, g);
    if (g.tournament_id) await bumpTournament(c, g.tournament_id);
    await batch.flush();
  });
}

export async function confirmResult(gameId: string, actor: Actor) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.result_status !== "reported" || !g.reported_winner_team_id)
      throw new FriendsError(409, "There is no reported result to confirm.");
    const mine = await mySide(c, g, actor.id);
    const reporterSide = g.reported_by ? await mySide(c, g, g.reported_by) : null;
    if (!mine || mine === reporterSide)
      throw new FriendsError(403, "The opposing side has to confirm the result.");
    await finalizeGame(c, g, g.reported_winner_team_id);
  });
}

export async function disputeResult(gameId: string, actor: Actor) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.result_status !== "reported")
      throw new FriendsError(409, "There is no reported result to dispute.");
    const mine = await mySide(c, g, actor.id);
    const reporterSide = g.reported_by ? await mySide(c, g, g.reported_by) : null;
    if (!mine || mine === reporterSide)
      throw new FriendsError(403, "Only the opposing side can dispute the result.");
    await c.query(
      `UPDATE friend_games
          SET result_status = 'disputed', reported_winner_team_id = NULL
        WHERE id = $1`,
      [gameId],
    );
    await bumpGame(c, gameId);
    const batch = new Batch(c);
    const href = g.tournament_id ? tournamentPath(g.tournament_id) : gamePath(gameId);
    const notified = uniq([
      ...(g.reported_by ? [g.reported_by] : []),
      g.organizer_id,
    ]).filter((p) => p !== actor.id);
    for (const pid of notified)
      await batch.notify(
        pid,
        "result_disputed",
        `${actor.nickname} disputed the result of ${g.name}. Report it again or ask the organizer to settle it.`,
        href,
      );
    await touchGame(c, batch, g);
    if (g.tournament_id) await bumpTournament(c, g.tournament_id);
    await batch.flush();
  });
}

/** organizer (or staff) sets the winner outright — e.g. to settle a dispute */
export async function settleResult(gameId: string, actor: Actor, winnerTeamId: string) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can settle a result.");
    if (g.status !== "ready" && g.status !== "in_progress")
      throw new FriendsError(409, "This game isn't in play.");
    if (g.is_bye) throw new FriendsError(400, "A BYE has no result.");
    if (winnerTeamId !== g.team_a_id && winnerTeamId !== g.team_b_id)
      throw new FriendsError(400, "Pick one of the two sides as the winner.");
    await finalizeGame(c, g, winnerTeamId);
  });
}

/** which side (team id) of this game is the player on, if they've accepted */
async function mySide(c: PoolClient, g: GameRow, playerId: string): Promise<string | null> {
  const ids = [g.team_a_id, g.team_b_id].filter((x): x is string => !!x);
  if (!ids.length) return null;
  const rows = await inTx(c)<{ team_id: string }>(
    `SELECT team_id FROM friend_team_members
      WHERE player_id = $1 AND status = 'accepted' AND team_id = ANY($2)`,
    [playerId, ids],
  );
  return rows[0]?.team_id ?? null;
}

/* ------------------------- completion + points ------------------------- */

async function addPoints(
  c: PoolClient,
  playerIds: string[],
  points: number,
  reason: PointReason,
  ctx: { gameId?: string; tournamentId?: string },
) {
  for (const pid of uniq(playerIds)) {
    await c.query(
      `INSERT INTO friend_points (id, player_id, game_id, tournament_id, points, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [nid("fpt"), pid, ctx.gameId ?? null, ctx.tournamentId ?? null, points, reason],
    );
  }
}

/** lock in a result: store it, award points, advance the bracket, tell everyone */
async function finalizeGame(c: PoolClient, g: GameRow, winnerTeamId: string) {
  const loserTeamId = winnerTeamId === g.team_a_id ? g.team_b_id : g.team_a_id;
  const winners = await teamPlayerIds(c, winnerTeamId);
  const losers = await teamPlayerIds(c, loserTeamId);
  const batch = new Batch(c);
  const winName = await teamName(c, winnerTeamId);
  let pointsForWinner = 0;
  let pointsForLoser = 0;

  await c.query(
    `UPDATE friend_games
        SET status = 'completed', winner_team_id = $2, result_status = 'none',
            reported_winner_team_id = NULL, completed_at = now(),
            started_at = COALESCE(started_at, now())
      WHERE id = $1`,
    [g.id, winnerTeamId],
  );

  if (!g.tournament_id) {
    // casual: win 10 / play 2, at most N pointed games per identical roster per day
    const key = rosterKey([...winners, ...losers]);
    const [recent] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_games
        WHERE tournament_id IS NULL AND roster_key = $1 AND points_awarded
          AND completed_at > now() - interval '24 hours' AND id <> $2`,
      [key, g.id],
    );
    const eligible = (recent?.n ?? 0) < MAX_POINTED_GAMES_PER_ROSTER_PER_DAY;
    await c.query(`UPDATE friend_games SET roster_key = $2, points_awarded = $3 WHERE id = $1`, [
      g.id,
      key,
      eligible,
    ]);
    if (eligible) {
      pointsForWinner = FRIEND_POINTS.gameWin;
      pointsForLoser = FRIEND_POINTS.gameLoss;
      await addPoints(c, winners, pointsForWinner, "game_win", { gameId: g.id });
      await addPoints(c, losers, pointsForLoser, "game_loss", { gameId: g.id });
    }
    for (const pid of uniq([...winners, ...losers]))
      await batch.notify(
        pid,
        "game_result",
        `${winName} won ${g.name}.` +
          (eligible
            ? ` You earned ${winners.includes(pid) ? pointsForWinner : pointsForLoser} Friends points.`
            : ""),
        gamePath(g.id),
      );
    await bumpGame(c, g.id);
    await touchGame(c, batch, g);
    await batch.flush();
    return;
  }

  // ---- tournament match ----
  const t = await lockTournament(c, g.tournament_id);
  const [{ rounds }] = await inTx(c)<{ rounds: number }>(
    `SELECT max(round)::int AS rounds FROM friend_games WHERE tournament_id = $1`,
    [t.id],
  );
  const isFinal = g.round === rounds;
  const isSemi = !isFinal && g.round === rounds - 1;
  const href = tournamentPath(t.id);

  if (t.points_eligible) {
    await addPoints(c, winners, FRIEND_POINTS.tournamentMatchWin, "match_win", {
      gameId: g.id,
      tournamentId: t.id,
    });
    if (isFinal) {
      await addPoints(c, winners, FRIEND_POINTS.champion, "champion", { tournamentId: t.id });
      await addPoints(c, losers, FRIEND_POINTS.runnerUp, "runner_up", { tournamentId: t.id });
    } else if (isSemi) {
      await addPoints(c, losers, FRIEND_POINTS.semiFinalist, "semi_finalist", { tournamentId: t.id });
    }
  }

  const label = g.round ? roundName(g.round, rounds) : "match";
  for (const pid of winners)
    await batch.notify(
      pid,
      isFinal ? "tournament_won" : "match_won",
      isFinal
        ? `You won ${t.name}! Champions: ${winName}.`
        : `You won your ${label.toLowerCase()} in ${t.name} and advance.`,
      href,
    );
  for (const pid of losers)
    await batch.notify(
      pid,
      "match_lost",
      isFinal
        ? `${winName} won ${t.name}. You finished as runner-up.`
        : `${winName} won your ${label.toLowerCase()} in ${t.name}.`,
      href,
    );

  if (g.next_game_id && g.next_slot) {
    await fillSlot(c, batch, g.next_game_id, g.next_slot, winnerTeamId, t);
  } else {
    await c.query(
      `UPDATE friend_tournaments
          SET status = 'completed', champion_team_id = $2, completed_at = now()
        WHERE id = $1`,
      [t.id, winnerTeamId],
    );
    for (const pid of await playersOfTournament(c, t.id))
      if (!winners.includes(pid) && !losers.includes(pid))
        await batch.notify(pid, "tournament_done", `${t.name} is over. ${winName} are the champions.`, href);
  }
  await bumpGame(c, g.id);
  await bumpTournament(c, t.id);
  await touchTournament(c, batch, t.id);
  await batch.flush();
}

/** put a team into a bracket slot; the next match becomes ready when both are set */
async function fillSlot(
  c: PoolClient,
  batch: Batch,
  gameId: string,
  slot: "a" | "b",
  teamId: string,
  t: TournamentRow,
) {
  const col = slot === "a" ? "team_a_id" : "team_b_id";
  const [row] = await inTx(c)<{ team_a_id: string | null; team_b_id: string | null }>(
    `UPDATE friend_games SET ${col} = $2, version = version + 1 WHERE id = $1
     RETURNING team_a_id, team_b_id`,
    [gameId, teamId],
  );
  if (row?.team_a_id && row.team_b_id) {
    await c.query(
      `UPDATE friend_games SET status = 'ready'
        WHERE id = $1 AND status = 'waiting_for_players'`,
      [gameId],
    );
    const na = await teamName(c, row.team_a_id);
    const nb = await teamName(c, row.team_b_id);
    for (const pid of [
      ...(await teamPlayerIds(c, row.team_a_id)),
      ...(await teamPlayerIds(c, row.team_b_id)),
    ])
      await batch.notify(
        pid,
        "match_ready",
        `Your next match in ${t.name} is ready: ${na} vs ${nb}.`,
        tournamentPath(t.id),
      );
  }
}

/* ==================================================================== */
/*  TOURNAMENTS                                                        */
/* ==================================================================== */

async function checkNewTeam(
  c: PoolClient,
  t: TournamentRow,
  playerIds: string[],
): Promise<Map<string, string>> {
  const f = FORMATS[t.format];
  const ids = uniq(playerIds);
  if (ids.length !== playerIds.length)
    throw new FriendsError(400, "A player can't be on the same team twice.");
  const sizeErr = validateTeamSize(f, ids.length);
  if (sizeErr) throw new FriendsError(400, sizeErr);
  const known = await existingPlayers(c, ids);
  if (known.size !== ids.length)
    throw new FriendsError(400, "One of the selected players could not be found.");
  const clash = await inTx(c)<{ nickname: string }>(
    `SELECT p.nickname FROM friend_team_members m
       JOIN player_profiles p ON p.id = m.player_id
      WHERE m.tournament_id = $1 AND m.player_id = ANY($2)`,
    [t.id, ids],
  );
  if (clash.length)
    throw new FriendsError(
      409,
      `${clash[0].nickname} is already a member of another team in this tournament.`,
    );
  return known;
}

async function insertTeam(
  c: PoolClient,
  batch: Batch,
  t: TournamentRow,
  playerIds: string[],
  actor: Actor,
) {
  const teamId = nid("ft");
  await c.query(`INSERT INTO friend_teams (id, tournament_id) VALUES ($1,$2)`, [teamId, t.id]);
  for (const pid of playerIds) {
    const self = pid === t.organizer_id;
    await c.query(
      `INSERT INTO friend_team_members
         (team_id, player_id, tournament_id, status, invited_by, responded_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [teamId, pid, t.id, self ? "accepted" : "invited", actor.id, self ? new Date() : null],
    );
    if (!self)
      await batch.notify(
        pid,
        "tournament_invite",
        `${actor.nickname} invited you to ${t.name} (${t.format} tournament).`,
        tournamentPath(t.id),
      );
  }
  return teamId;
}

export async function createTournament(
  actor: Actor,
  input: {
    name?: string;
    format: unknown;
    capacityTeams: unknown;
    seeding?: unknown;
    teams?: string[][];
  },
): Promise<string> {
  if (actor.role !== "player") throw new FriendsError(403, "Only players can create tournaments.");
  if (!isFormat(input.format)) throw new FriendsError(400, "Choose 1v1 or 2v2.");
  const f = FORMATS[input.format];
  const capacity = Number(input.capacityTeams);
  if (!(TOURNAMENT_SIZES as readonly number[]).includes(capacity))
    throw new FriendsError(400, `Choose a size of ${TOURNAMENT_SIZES.join(", ")}.`);
  const seeding = input.seeding === "ranking" ? "ranking" : "random";
  const teams = input.teams ?? [];
  if (teams.length > capacity)
    throw new FriendsError(
      400,
      `This tournament has ${capacity} places but you added ${teams.length}. Remove ${teams.length - capacity}.`,
    );

  return transaction(async (c) => {
    const [open] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_tournaments
        WHERE organizer_id = $1 AND status IN ('registration_open','in_progress')`,
      [actor.id],
    );
    if ((open?.n ?? 0) >= MAX_OPEN_TOURNAMENTS_PER_ORGANIZER)
      throw new FriendsError(
        400,
        `You already have ${MAX_OPEN_TOURNAMENTS_PER_ORGANIZER} unfinished tournaments. Finish or cancel one first.`,
      );
    const id = nid("ftn");
    const name = cleanName(input.name, `${actor.nickname}'s ${f.code} tournament`);
    await c.query(
      `INSERT INTO friend_tournaments
         (id, name, organizer_id, format, players_per_team, capacity_teams, seeding)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, name, actor.id, f.code, f.playersPerTeam, capacity, seeding],
    );
    const t = await lockTournament(c, id);
    const batch = new Batch(c);
    for (const team of teams) {
      await checkNewTeam(c, t, team);
      await insertTeam(c, batch, t, team, actor);
    }
    await touchTournament(c, batch, id);
    await batch.flush();
    return id;
  });
}

function assertOrganizer(t: TournamentRow, actor: Actor) {
  if (t.organizer_id !== actor.id && !isMod(actor))
    throw new FriendsError(403, "Only the organizer can do that.");
}
function assertOpen(t: TournamentRow) {
  if (t.status !== "registration_open")
    throw new FriendsError(409, "This tournament has already started or finished.");
}

/** organizer adds a team (1 player for 1v1, 2 for 2v2) */
export async function addTeam(tournamentId: string, actor: Actor, playerIds: string[]) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const [{ n }] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_teams WHERE tournament_id = $1`,
      [tournamentId],
    );
    if (n >= t.capacity_teams)
      throw new FriendsError(
        409,
        `This tournament is already full (${n}/${t.capacity_teams} ${t.format === "1v1" ? "players" : "teams"}).`,
      );
    await checkNewTeam(c, t, playerIds);
    const batch = new Batch(c);
    await insertTeam(c, batch, t, playerIds, actor);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** fill an open seat on a team (e.g. after someone declined) */
export async function addTeamMember(
  tournamentId: string,
  actor: Actor,
  teamId: string,
  playerId: string,
) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const [team] = await inTx(c)<{ id: string; n: number }>(
      `SELECT t.id, count(m.*)::int AS n FROM friend_teams t
         LEFT JOIN friend_team_members m ON m.team_id = t.id
        WHERE t.id = $1 AND t.tournament_id = $2 GROUP BY t.id`,
      [teamId, tournamentId],
    );
    if (!team) throw new FriendsError(404, "Team not found.");
    if (team.n >= t.players_per_team)
      throw new FriendsError(409, `A ${t.format} team must contain exactly ${t.players_per_team} players.`);
    await checkTeamMemberOnly(c, t, playerId);
    await c.query(
      `INSERT INTO friend_team_members (team_id, player_id, tournament_id, status, invited_by, responded_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        teamId,
        playerId,
        tournamentId,
        playerId === t.organizer_id ? "accepted" : "invited",
        actor.id,
        playerId === t.organizer_id ? new Date() : null,
      ],
    );
    const batch = new Batch(c);
    if (playerId !== t.organizer_id)
      await batch.notify(
        playerId,
        "tournament_invite",
        `${actor.nickname} invited you to ${t.name} (${t.format} tournament).`,
        tournamentPath(tournamentId),
      );
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

async function checkTeamMemberOnly(c: PoolClient, t: TournamentRow, playerId: string) {
  const known = await existingPlayers(c, [playerId]);
  if (!known.has(playerId)) throw new FriendsError(400, "That player could not be found.");
  const [clash] = await inTx(c)<{ nickname: string }>(
    `SELECT p.nickname FROM friend_team_members m
       JOIN player_profiles p ON p.id = m.player_id
      WHERE m.tournament_id = $1 AND m.player_id = $2`,
    [t.id, playerId],
  );
  if (clash)
    throw new FriendsError(
      409,
      `${clash.nickname} is already a member of another team in this tournament.`,
    );
  return known;
}

export async function removeTeam(tournamentId: string, actor: Actor, teamId: string) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const members = await inTx(c)<{ player_id: string }>(
      `SELECT player_id FROM friend_team_members WHERE team_id = $1`,
      [teamId],
    );
    const res = await c.query(`DELETE FROM friend_teams WHERE id = $1 AND tournament_id = $2`, [
      teamId,
      tournamentId,
    ]);
    if (!res.rowCount) throw new FriendsError(404, "Team not found.");
    const batch = new Batch(c);
    for (const m of members) {
      if (m.player_id !== actor.id)
        await batch.notify(m.player_id, "removed", `You were removed from ${t.name}.`, null);
      batch.touch(`user:${m.player_id}`);
    }
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** organizer removes one player from a team (the team stays, with a free seat) */
export async function removeTournamentMember(
  tournamentId: string,
  actor: Actor,
  playerId: string,
) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const res = await c.query(
      `DELETE FROM friend_team_members WHERE tournament_id = $1 AND player_id = $2`,
      [tournamentId, playerId],
    );
    if (!res.rowCount) throw new FriendsError(404, "That player is not in this tournament.");
    await c.query(
      `DELETE FROM friend_teams ft WHERE ft.tournament_id = $1
         AND NOT EXISTS (SELECT 1 FROM friend_team_members m WHERE m.team_id = ft.id)`,
      [tournamentId],
    );
    const batch = new Batch(c);
    if (playerId !== actor.id)
      await batch.notify(playerId, "removed", `You were removed from ${t.name}.`, null);
    batch.touch(`user:${playerId}`);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** accept or decline an invitation; declining after accepting = leaving */
export async function respondToTournament(tournamentId: string, actor: Actor, accept: boolean) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOpen(t);
    const [m] = await inTx(c)<{ team_id: string; status: string }>(
      `SELECT team_id, status FROM friend_team_members
        WHERE tournament_id = $1 AND player_id = $2`,
      [tournamentId, actor.id],
    );
    if (!m) throw new FriendsError(404, "You are not in this tournament.");
    if (accept) {
      await c.query(
        `UPDATE friend_team_members SET status = 'accepted', responded_at = now()
          WHERE tournament_id = $1 AND player_id = $2`,
        [tournamentId, actor.id],
      );
    } else {
      await c.query(
        `DELETE FROM friend_team_members WHERE tournament_id = $1 AND player_id = $2`,
        [tournamentId, actor.id],
      );
      await c.query(
        `DELETE FROM friend_teams ft WHERE ft.tournament_id = $1
           AND NOT EXISTS (SELECT 1 FROM friend_team_members x WHERE x.team_id = ft.id)`,
        [tournamentId],
      );
    }
    const batch = new Batch(c);
    if (t.organizer_id !== actor.id) {
      const [{ n }] = await inTx(c)<{ n: number }>(
        `SELECT count(*)::int AS n FROM friend_team_members
          WHERE tournament_id = $1 AND status = 'accepted'`,
        [tournamentId],
      );
      const need = requiredTournamentPlayers(FORMATS[t.format], t.capacity_teams);
      await batch.notify(
        t.organizer_id,
        accept ? "invite_accepted" : "invite_declined",
        accept
          ? `${actor.nickname} joined ${t.name} — players ${n}/${need}.`
          : `${actor.nickname} left ${t.name}.`,
        tournamentPath(tournamentId),
      );
    }
    batch.touch(`user:${actor.id}`);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

async function seedTeams(c: PoolClient, t: TournamentRow, teamIds: string[]): Promise<string[]> {
  // Fisher–Yates first, so ties under "ranking" are broken randomly too
  const order = [...teamIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (t.seeding !== "ranking") return order;
  const { stats } = await computeStats();
  const members = await inTx(c)<{ team_id: string; player_id: string }>(
    `SELECT team_id, player_id FROM friend_team_members WHERE team_id = ANY($1)`,
    [teamIds],
  );
  const strength = new Map<string, number>();
  for (const m of members)
    strength.set(m.team_id, (strength.get(m.team_id) ?? 0) + (stats.get(m.player_id)?.rankingPoints ?? 0));
  return order.sort((a, b) => (strength.get(b) ?? 0) - (strength.get(a) ?? 0));
}

/**
 * Start: generate the whole bracket from the complete teams. If teams are
 * incomplete or fewer than the capacity, the organizer must confirm first
 * (409 with code "confirm"), because incomplete teams are dropped and the
 * gaps become BYEs.
 */
export async function startTournament(tournamentId: string, actor: Actor, force: boolean) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const rawTeams = await loadTeams(inTx(c), { tournamentId });
    const teams = rawTeams.map((r) => toTeamView(r, t.players_per_team));
    const complete = teams.filter((x) => x.complete);
    const incomplete = teams.filter((x) => !x.complete);
    const noun = t.format === "1v1" ? "players" : "teams";
    if (complete.length < MIN_TEAMS_TO_START)
      throw new FriendsError(
        400,
        `At least ${MIN_TEAMS_TO_START} complete ${noun} are needed to start (you have ${complete.length}).`,
      );
    const byes = nextPow2(complete.length) - complete.length;
    if ((incomplete.length > 0 || complete.length < t.capacity_teams) && !force) {
      throw new FriendsError(409, "Please confirm starting with the current line-up.", {
        code: "confirm",
        complete: complete.length,
        capacity: t.capacity_teams,
        dropped: incomplete.map((x) => x.name),
        byes,
      });
    }

    const batch = new Batch(c);
    // drop unfinished teams and tell their members
    for (const team of incomplete) {
      for (const m of team.members)
        await batch.notify(
          m.id,
          "removed",
          `${t.name} started without your team — it wasn't complete in time.`,
          null,
        );
    }
    if (incomplete.length)
      await c.query(`DELETE FROM friend_teams WHERE id = ANY($1)`, [incomplete.map((x) => x.id)]);

    const seeded = await seedTeams(c, t, complete.map((x) => x.id));
    for (let i = 0; i < seeded.length; i++)
      await c.query(`UPDATE friend_teams SET seed = $2 WHERE id = $1`, [seeded[i], i + 1]);
    const bracket = generateBracket(seeded);

    const gameId = new Map<string, string>();
    const key = (r: number, p: number) => `${r}:${p}`;
    for (const g of bracket.games) gameId.set(key(g.round, g.position), nid("fg"));

    for (const g of bracket.games) {
      const id = gameId.get(key(g.round, g.position))!;
      const next = g.next ? gameId.get(key(g.next.round, g.next.position))! : null;
      const both = g.a !== null && g.b !== null;
      await c.query(
        `INSERT INTO friend_games
           (id, name, organizer_id, format, players_per_team, status, tournament_id, round, position,
            next_game_id, next_slot, is_bye, team_a_id, team_b_id, winner_team_id, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          id,
          `${t.name} — ${roundName(g.round, bracket.rounds)}`,
          t.organizer_id,
          t.format,
          t.players_per_team,
          g.isBye ? "completed" : both ? "ready" : "waiting_for_players",
          t.id,
          g.round,
          g.position,
          next,
          g.next?.slot ?? null,
          g.isBye,
          g.a,
          g.b,
          g.isBye ? (g.a ?? g.b) : null,
          g.isBye ? new Date() : null,
        ],
      );
    }
    // BYEs advance immediately, through the same slot-filling path as real wins
    const started: TournamentRow = { ...t, status: "in_progress" };
    for (const g of bracket.games.filter((x) => x.isBye && x.next)) {
      const winner = (g.a ?? g.b) as string;
      await fillSlot(
        c,
        batch,
        gameId.get(key(g.next!.round, g.next!.position))!,
        g.next!.slot,
        winner,
        started,
      );
    }

    const players = (
      await inTx(c)<{ player_id: string }>(
        `SELECT player_id FROM friend_team_members WHERE tournament_id = $1`,
        [t.id],
      )
    ).map((r) => r.player_id);
    const rkey = rosterKey(players);
    const [recent] = await inTx(c)<{ n: number }>(
      `SELECT count(*)::int AS n FROM friend_tournaments
        WHERE roster_key = $1 AND points_eligible AND id <> $2
          AND started_at > now() - interval '24 hours'`,
      [rkey, t.id],
    );
    const eligible = (recent?.n ?? 0) < MAX_POINTED_TOURNAMENTS_PER_ROSTER_PER_DAY;
    await c.query(
      `UPDATE friend_tournaments
          SET status = 'in_progress', started_at = now(), roster_key = $2, points_eligible = $3
        WHERE id = $1`,
      [t.id, rkey, eligible],
    );
    for (const pid of uniq(players))
      await batch.notify(
        pid,
        "tournament_started",
        `${t.name} has started — the bracket is live.`,
        tournamentPath(t.id),
      );
    await bumpTournament(c, t.id);
    await touchTournament(c, batch, t.id);
    for (const team of incomplete) for (const m of team.members) batch.touch(`user:${m.id}`);
    await batch.flush();
  });
}

export async function cancelTournament(tournamentId: string, actor: Actor) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    if (t.status !== "registration_open" && t.status !== "in_progress")
      throw new FriendsError(409, "This tournament is already finished.");
    await c.query(`UPDATE friend_tournaments SET status = 'cancelled' WHERE id = $1`, [tournamentId]);
    await c.query(
      `UPDATE friend_games SET status = 'cancelled', version = version + 1
        WHERE tournament_id = $1 AND status IN ('waiting_for_players','ready','in_progress')`,
      [tournamentId],
    );
    const batch = new Batch(c);
    for (const pid of uniq(await playersOfTournament(c, tournamentId)))
      if (pid !== actor.id)
        await batch.notify(pid, "tournament_cancelled", `${t.name} was cancelled.`, tournamentPath(tournamentId));
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

