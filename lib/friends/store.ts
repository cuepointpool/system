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
import { RANKING_CONFIG } from "../ecosystem/ranking";
import { cancelCodeOk, newCancelCode } from "../cancel-code";
import { roundName } from "./bracket";
import {
  blockingTies,
  computeStandings,
  cutsFor,
  groupName,
  hasPlayoffs,
  normalizeSettings,
  planMain,
  planPlayoffs,
  validateSettings,
  bestOfFor,
  bestOfLabel,
  checkScore,
  type BlockingTie,
  type PlanGame,
  type Stage,
  type StandingRow,
  type TournamentKind,
  type TournamentSettings,
} from "./structure";
import {
  FORMATS,
  isFormat,
  MIN_TEAMS_TO_START,
  MAX_TOURNAMENT_TEAMS,
  isValidTournamentSize,
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
  PendingTie,
  StandingView,
  TournamentSection,
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
/** today in Sri Lanka, YYYY-MM-DD */
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
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
  stage: Stage;
  group_no: number | null;
  label: string | null;
  loser_next_game_id: string | null;
  loser_next_slot: "a" | "b" | null;
  due_date: string | null;
  best_of: number;
  score_a: number | null;
  score_b: number | null;
  reported_score_a: number | null;
  reported_score_b: number | null;
  table_name: string | null;
}

type Score = { a: number; b: number };

/** the frame score to store for a result; a single-frame match is simply 1–0 */
function scoreFor(g: GameRow, winner: string, raw?: Score | null): Score {
  const winnerIsA = winner === g.team_a_id;
  const bestOf = g.best_of ?? 1;
  if (bestOf === 1) return winnerIsA ? { a: 1, b: 0 } : { a: 0, b: 1 };
  if (!raw) throw new FriendsError(400, `This match is ${bestOfLabel(bestOf)} — enter the frame score.`);
  const problem = checkScore(bestOf, raw.a, raw.b);
  if (problem) throw new FriendsError(400, problem);
  if (raw.a > raw.b !== winnerIsA) throw new FriendsError(400, "That score doesn't match the winner.");
  return { a: raw.a, b: raw.b };
}
const scoreText = (g: { best_of: number }, s: Score) => (g.best_of > 1 ? ` ${s.a}–${s.b}` : "");

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
  kind: TournamentKind;
  settings: Partial<TournamentSettings>;
  phase: "main" | "tiebreak" | "playoffs";
  tiebreaks: { group: number | null; teams: string[] }[];
  cancel_code_hash: string | null;
  cancel_code_expires: Date | null;
}

const settingsOf = (t: Pick<TournamentRow, "kind" | "settings">): TournamentSettings =>
  normalizeSettings({ ...(t.settings ?? {}), kind: t.kind });

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
  // guests sit in a seat like anyone else, but have no account to accept with
  if (out.size) {
    const guests = await db<{ id: string; team_id: string; name: string }>(
      `SELECT id, team_id, name FROM friend_team_guests
        WHERE team_id = ANY($1) ORDER BY created_at`,
      [[...out.keys()]],
    );
    for (const g of guests)
      out.get(g.team_id)?.members.push({
        id: g.id,
        slug: "",
        nickname: g.name,
        avatar: null,
        status: "accepted",
        guest: true,
      });
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
    hasGuest: t.members.some((m) => m.guest),
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
      canChange:
        g.status === "completed" && !g.is_bye && !!teamA && !!teamB && (isOrganizer || isMod(actor)),
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
      roundName: g.label
        ? (g.group_no ? `${groupName(g.group_no)} · ` : "") + g.label
        : g.round && total
          ? roundName(g.round, total)
          : null,
      position: g.position,
      stage: g.tournament_id ? g.stage : null,
      group: g.group_no,
      dueDate: g.due_date,
      bestOf: g.best_of ?? 1,
      scoreA: g.score_a,
      scoreB: g.score_b,
      reportedScoreA: g.reported_score_a,
      reportedScoreB: g.reported_score_b,
      tableName: g.table_name,
      isBye: g.is_bye,
      guestMatch: !!teamA?.hasGuest || !!teamB?.hasGuest,
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
  const view = new Map(games.map((g) => [g.id, g]));
  const byId = new Map(teams.map((x) => [x.id, x]));
  const s = settingsOf(t);

  // ---- tables (league / groups) ----
  const tables = t.status === "registration_open" ? [] : buildTables(t, seedOrderOf(teams), gameRows);
  const live = (g: GameRow) =>
    g.status === "waiting_for_players" || g.status === "ready" || g.status === "in_progress";

  // ---- sections: the tabs on the page ----
  const roundsOf = (rows: GameRow[]): BracketRound[] => {
    const byRound = new Map<number, GameRow[]>();
    for (const g of rows) byRound.set(g.round ?? 0, [...(byRound.get(g.round ?? 0) ?? []), g]);
    const last = Math.max(0, ...rows.map((x) => x.round ?? 0));
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, gs]) => ({
        round,
        name: gs[0].label ?? roundName(round, last),
        games: gs
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((g) => view.get(g.id))
          .filter((g): g is GameView => !!g),
      }));
  };
  const of = (...stages: Stage[]) => gameRows.filter((g) => stages.includes(g.stage));
  const sections: TournamentSection[] = [];
  const bracket = (sid: string, title: string, main: GameRow[], third: GameRow[] = []) => {
    if (!main.length) return;
    const rounds = roundsOf(main);
    if (third.length)
      rounds.push({
        round: 999,
        name: "3rd place",
        games: third.map((g) => view.get(g.id)).filter((g): g is GameView => !!g),
      });
    sections.push({ id: sid, title, kind: "bracket", rounds });
  };

  if (t.kind === "knockout") bracket("bracket", "Bracket", of("knockout"), of("third_place"));
  if (t.kind === "double_elim") {
    bracket("upper", "Upper bracket", of("upper"));
    bracket("lower", "Lower bracket", of("lower"));
    bracket("final", "Grand final", of("grand_final"));
  }
  if (t.kind === "league" || t.kind === "groups") {
    for (const tb of tables) {
      const rows = of(t.kind === "league" ? "league" : "group").filter((g) => g.group_no === tb.group);
      const finished = t.status === "completed" || (rows.length > 0 && !rows.some(live) && t.phase !== "main");
      const settled = finished && !blockingTies(tb.rows, tb.cuts, tb.group).length;
      const through = qualifyCount(s, tb.rows.length);
      sections.push({
        id: tb.group ? `group-${tb.group}` : "table",
        title: tb.group ? groupName(tb.group) : "Table",
        kind: "table",
        group: tb.group,
        rows: tb.rows
          .filter((r) => byId.has(r.teamId))
          .map((r): StandingView => ({ ...r, team: byId.get(r.teamId)!, through: settled && r.position <= through })),
        cuts: tb.cuts,
        cutNote: cutNote(s, tb.rows.length),
        rounds: roundsOf(rows),
      });
    }
    bracket("playoffs", t.kind === "league" ? "Playoffs" : "Knockout", of("playoff"), of("third_place"));
  }
  const deciders = of("decider");
  if (deciders.length)
    sections.push({
      id: "tiebreak",
      title: "Tie-breakers",
      kind: "list",
      games: deciders.map((g) => view.get(g.id)).filter((g): g is GameView => !!g),
    });

  // ---- ties the tournament is waiting on ----
  const pendingTies: PendingTie[] =
    t.status === "in_progress" && t.phase === "tiebreak"
      ? tables
          .flatMap((tb) => blockingTies(tb.rows, tb.cuts, tb.group))
          .map((tie) => {
            const among = deciders.filter(
              (g) => tie.teamIds.includes(g.team_a_id ?? "") && tie.teamIds.includes(g.team_b_id ?? ""),
            );
            const open = among.filter(live);
            const rounds = new Set(among.map((g) => g.round)).size;
            return {
              group: tie.group,
              title: tieTitle(tie, s),
              teams: tie.teamIds.map((x) => byId.get(x)).filter((x): x is TeamView => !!x),
              matchesLeft: open.length,
              playoffRound: Math.max(1, rounds),
            };
          })
      : [];

  // ---- the viewer's next match ----
  const mine = games.filter(
    (g) => g.viewer.teamId && !g.isBye && (g.status === "ready" || g.status === "in_progress"),
  );
  const myNextGame =
    mine.find((g) => g.viewer.canConfirm) ??
    mine.find((g) => g.resultStatus === "disputed") ??
    [...mine].sort(
      (a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9") || (a.round ?? 0) - (b.round ?? 0),
    )[0] ??
    null;

  const place = placementsFrom(t, gameRows, tables);
  const team = (x: string | null) => (x ? (byId.get(x) ?? null) : null);

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
    canEditFormat: open && isOrganizer,
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
    guests: teams.reduce((n, x) => n + x.members.filter((m) => m.guest).length, 0),
    kind: t.kind,
    settings: s,
    phase: t.phase,
    sections,
    pendingTies,
    myNextGame,
    byes: games.filter((g) => g.isBye).length,
    champion: team(place.champion),
    runnerUp: team(place.runnerUp),
    third: team(place.third),
    groupWinners: place.groupWinners.flatMap((w) => {
      const tm = byId.get(w.teamId);
      return tm ? [{ group: w.group, title: groupName(w.group), team: tm }] : [];
    }),
    version: t.version,
    createdAt: iso(t.created_at),
    startedAt: isoOrNull(t.started_at),
    completedAt: isoOrNull(t.completed_at),
    viewer,
  };
}

/* ---------------------- tables, placements (shared) ---------------------- */

interface Table {
  group: number | null;
  rows: StandingRow[];
  cuts: number[];
}

/** team ids in seed order (unseeded last, in the order they were added) */
function seedOrderOf(teams: { id: string; seed: number | null }[]): string[] {
  return teams
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.seed ?? 1e9) - (b.x.seed ?? 1e9) || a.i - b.i)
    .map(({ x }) => x.id);
}

type GameLite = Pick<
  GameRow,
  | "id" | "stage" | "group_no" | "team_a_id" | "team_b_id" | "winner_team_id" | "status" | "next_game_id" | "is_bye"
  | "score_a" | "score_b"
>;

/** the league table, or one table per group, from the finished table matches */
function buildTables(t: TournamentRow, seedIds: string[], games: GameLite[]): Table[] {
  if (t.kind !== "league" && t.kind !== "groups") return [];
  const s = settingsOf(t);
  const stage: Stage = t.kind === "league" ? "league" : "group";
  const played = games.filter((g) => g.stage === stage);
  // play-offs between level players are listed under their group (or the league)
  const groupNos: (number | null)[] =
    t.kind === "league"
      ? [null]
      : [...new Set(played.map((g) => g.group_no))].sort((a, b) => (a ?? 0) - (b ?? 0));
  return groupNos.map((group) => {
    const gs = played.filter((g) => g.group_no === group);
    const inGroup = new Set(gs.flatMap((g) => [g.team_a_id, g.team_b_id]).filter((x): x is string => !!x));
    const ids = seedIds.filter((x) => inGroup.has(x));
    const rows = computeStandings(
      ids,
      gs
        .filter((g) => g.status === "completed")
        .map((g) => ({ a: g.team_a_id, b: g.team_b_id, winner: g.winner_team_id, scoreA: g.score_a, scoreB: g.score_b })),
      {
        tiebreak: s.tiebreak,
        orders: (t.tiebreaks ?? []).filter((o) => (o.group ?? null) === group).map((o) => o.teams),
        deciders: games
          .filter((g) => g.stage === "decider" && g.group_no === group && g.status === "completed")
          .map((g) => ({ a: g.team_a_id, b: g.team_b_id, winner: g.winner_team_id })),
      },
    );
    return { group, rows, cuts: cutsFor(s, ids.length) };
  });
}

/** how many places at the top of a table "go through" */
function qualifyCount(s: TournamentSettings, size: number): number {
  if (s.kind === "groups") return s.groupFinish === "knockout" ? s.advance : 1;
  if (s.finish === "table") return 1;
  if (s.finish === "final") return s.thirdPlace && size >= 4 ? 4 : 2;
  return s.finish === "top4" ? 4 : 8;
}

function cutNote(s: TournamentSettings, size: number): string {
  if (s.kind === "groups")
    return s.groupFinish === "knockout"
      ? `Top ${s.advance} go through to the knockout`
      : "The group winner takes the group";
  if (s.finish === "table") return "Top of the table wins";
  if (s.finish === "final")
    return s.thirdPlace && size >= 4
      ? "1st v 2nd in the final · 3rd v 4th for 3rd place"
      : "1st v 2nd in the final";
  return s.finish === "top4" ? "Top 4 go to the semi finals" : "Top 8 go to the quarter finals";
}

function tieTitle(tie: BlockingTie, s: TournamentSettings): string {
  const where = tie.group ? `${groupName(tie.group)}: ` : "";
  const what =
    s.kind === "groups"
      ? s.groupFinish === "knockout"
        ? `the last place through (top ${tie.cut})`
        : "the group win"
      : s.finish === "table"
        ? "1st place"
        : tie.cut === 2
          ? "a place in the final"
          : tie.cut === 4 && s.finish === "final"
            ? "the 3rd-place match"
            : `a place in the top ${tie.cut}`;
  return `${where}${tie.teamIds.length} level on points for ${what}`;
}

interface Placements {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
  /** semi-final losers (or the nearest equivalent) — they earn semi-finalist points */
  semis: string[];
  groupWinners: { group: number; teamId: string }[];
}

function placementsFrom(t: TournamentRow, games: GameLite[], tables: Table[]): Placements {
  const s = settingsOf(t);
  const none: Placements = { champion: null, runnerUp: null, third: null, semis: [], groupWinners: [] };
  const loserOf = (g: GameLite) => (g.winner_team_id === g.team_a_id ? g.team_b_id : g.team_a_id);
  const done = (g: GameLite) => g.status === "completed" && !!g.winner_team_id;

  if (t.kind === "league" && s.finish === "table") {
    if (t.status !== "completed") return none;
    const r = tables[0]?.rows ?? [];
    return {
      ...none,
      champion: r[0]?.teamId ?? null,
      runnerUp: r[1]?.teamId ?? null,
      third: r[2]?.teamId ?? null,
      semis: r[2] ? [r[2].teamId] : [],
    };
  }
  if (t.kind === "groups" && s.groupFinish === "none") {
    if (t.status !== "completed") return none;
    return {
      ...none,
      groupWinners: tables
        .filter((x) => x.rows[0])
        .map((x) => ({ group: x.group ?? 1, teamId: x.rows[0].teamId })),
    };
  }
  const finalStage: Stage =
    t.kind === "knockout" ? "knockout" : t.kind === "double_elim" ? "grand_final" : "playoff";
  const fin = games.find((g) => g.stage === finalStage && !g.next_game_id && !g.is_bye);
  const thirdGame = games.find((g) => g.stage === "third_place");
  const out: Placements = { ...none };
  if (fin && done(fin)) {
    out.champion = fin.winner_team_id;
    out.runnerUp = loserOf(fin);
  }
  if (thirdGame && done(thirdGame)) out.third = thirdGame.winner_team_id;
  if (t.kind === "double_elim") {
    const lowerFinal = games.find((g) => g.stage === "lower" && !!fin && g.next_game_id === fin.id);
    if (lowerFinal && done(lowerFinal)) {
      const l = loserOf(lowerFinal);
      out.third = l;
      out.semis = l ? [l] : [];
    }
  } else if (fin) {
    out.semis = games
      .filter((g) => g.next_game_id === fin.id && !g.is_bye && done(g))
      .map(loserOf)
      .filter((x): x is string => !!x);
    if (!out.semis.length && thirdGame && done(thirdGame))
      out.semis = [thirdGame.team_a_id, thirdGame.team_b_id].filter((x): x is string => !!x);
  }
  return out;
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
                 WHERE m.team_id = ft.id AND m.status = 'accepted')
             + (SELECT count(*) FROM friend_team_guests gg WHERE gg.team_id = ft.id)
             = t.players_per_team)::int AS teams_complete,
       ((SELECT count(*) FROM friend_team_members m
          WHERE m.tournament_id = t.id AND m.status = 'accepted')
        + (SELECT count(*) FROM friend_team_guests gg WHERE gg.tournament_id = t.id))::int AS players_joined,
       EXISTS (SELECT 1 FROM friend_team_members m
                WHERE m.tournament_id = t.id AND m.player_id = $1 AND m.status = 'invited') AS invited,
       (SELECT g.id FROM friend_games g
          JOIN friend_team_members m
            ON m.player_id = $1 AND m.tournament_id = t.id
           AND m.status = 'accepted' AND m.team_id IN (g.team_a_id, g.team_b_id)
         WHERE g.tournament_id = t.id AND g.status IN ('ready','in_progress')
         ORDER BY g.due_date NULLS LAST, g.round LIMIT 1) AS next_game_id
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
    kind: t.kind,
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
    `SELECT nickname FROM (
       SELECT p.nickname, m.created_at, 0 AS guest FROM friend_team_members m
         JOIN player_profiles p ON p.id = m.player_id
        WHERE m.team_id = $1
       UNION ALL
       SELECT g.name, g.created_at, 1 FROM friend_team_guests g WHERE g.team_id = $1
     ) x ORDER BY guest, created_at`,
    [teamId],
  );
  return rows.map((r) => r.nickname).join(" & ") || "TBD";
}

/** is a guest (a player with no account) sitting on this team? */
async function teamHasGuest(c: PoolClient, teamId: string | null): Promise<boolean> {
  if (!teamId) return false;
  const rows = await inTx(c)<{ ok: number }>(
    `SELECT 1 AS ok FROM friend_team_guests WHERE team_id = $1 LIMIT 1`,
    [teamId],
  );
  return rows.length > 0;
}

/** remove tournament teams that have nobody left on them */
async function dropEmptyTeams(c: PoolClient, tournamentId: string) {
  await c.query(
    `DELETE FROM friend_teams ft WHERE ft.tournament_id = $1
       AND NOT EXISTS (SELECT 1 FROM friend_team_members m WHERE m.team_id = ft.id)
       AND NOT EXISTS (SELECT 1 FROM friend_team_guests gg WHERE gg.team_id = ft.id)`,
    [tournamentId],
  );
}

/** a guest's display name: trimmed, single-spaced, 2–30 characters */
function cleanGuestName(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (s.length < 2) throw new FriendsError(400, "A guest needs a name of at least 2 characters.");
  return s;
}

async function teamPlayerIds(c: PoolClient, teamId: string | null): Promise<string[]> {
  if (!teamId) return [];
  const rows = await inTx(c)<{ player_id: string }>(
    `SELECT player_id FROM friend_team_members WHERE team_id = $1 AND status = 'accepted'`,
    [teamId],
  );
  return rows.map((r) => r.player_id);
}

/**
 * The Cue Point in-house leaderboard counts friends play too — but only a
 * finished 1v1 between two REGISTERED players. A guest on either side, a 2v2,
 * a BYE, or a game over the daily anti-farming limit never moves it.
 * Idempotent: it rewrites this game's single entry in `matches` (or removes
 * it), so a changed or undone result is reflected straight away.
 */
async function syncInhouseMatch(c: PoolClient, gameId: string) {
  await c.query(`DELETE FROM matches WHERE friend_game_id = $1`, [gameId]);
  const [g] = (
    await c.query<GameRow & { t_eligible: boolean | null; t_name: string | null }>(
      `SELECT g.*, t.points_eligible AS t_eligible, t.name AS t_name
         FROM friend_games g LEFT JOIN friend_tournaments t ON t.id = g.tournament_id
        WHERE g.id = $1`,
      [gameId],
    )
  ).rows;
  if (!g || g.status !== "completed" || g.is_bye || !g.winner_team_id || g.players_per_team !== 1) return;
  if (!(g.tournament_id ? g.t_eligible : g.points_awarded)) return;
  if ((await teamHasGuest(c, g.team_a_id)) || (await teamHasGuest(c, g.team_b_id))) return;
  const [a] = await teamPlayerIds(c, g.team_a_id);
  const [b] = await teamPlayerIds(c, g.team_b_id);
  if (!a || !b || a === b) return;
  const players = await inTx(c)<{ id: string }>(
    `SELECT id FROM player_profiles WHERE id = ANY($1) AND role = 'player'`,
    [[a, b]],
  );
  if (players.length !== 2) return; // staff accounts don't rank
  const winner = g.winner_team_id === g.team_a_id ? a : b;
  const { stats } = await computeStats();
  const pa = stats.get(a)?.rankingPoints ?? RANKING_CONFIG.startPoints;
  const pb = stats.get(b)?.rankingPoints ?? RANKING_CONFIG.startPoints;
  await c.query(
    `INSERT INTO matches
       (id, ref, type, player_a_id, player_b_id, score_a, score_b, winner_id, table_name,
        tournament_round, played_at, a_points_before, a_points_after, b_points_before, b_points_after,
        recorded_by, friend_game_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Friends play',$9,$10,$11,$11,$12,$12,'friends',$13)`,
    [
      nid("m"),
      "CP-F-" + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase(),
      g.tournament_id ? "ranked" : "casual",
      a,
      b,
      g.score_a ?? (winner === a ? 1 : 0),
      g.score_b ?? (winner === b ? 1 : 0),
      winner,
      g.tournament_id ? `${g.t_name ?? "Friends tournament"} · ${g.label ?? "match"}` : null,
      g.completed_at ?? new Date(),
      pa,
      pb,
      g.id,
    ],
  );
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

/**
 * Start a match. Matches run in parallel — any number at once on different
 * tables; `tableName` (optional) notes which table this one is on. The one
 * rule: a player can't be in two running matches of the same tournament.
 */
export async function startGame(gameId: string, actor: Actor, tableName?: string | null) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    const involved = !!(await mySide(c, g, actor.id)) || g.organizer_id === actor.id || isMod(actor);
    if (!involved) throw new FriendsError(403, "Only the players can start this game.");
    if (g.status !== "ready")
      throw new FriendsError(409, "Everyone has to accept before the game can start.");
    if (g.tournament_id) {
      // an entry (player or team, guests included) can only be at one table at a time
      const sides = [g.team_a_id, g.team_b_id].filter((x): x is string => !!x);
      const [busy] = await inTx(c)<{ team: string; label: string | null; table_name: string | null }>(
        `SELECT CASE WHEN og.team_a_id = ANY($3) THEN og.team_a_id ELSE og.team_b_id END AS team,
                og.label, og.table_name
           FROM friend_games og
          WHERE og.tournament_id = $1 AND og.status = 'in_progress' AND og.id <> $2
            AND (og.team_a_id = ANY($3) OR og.team_b_id = ANY($3))
          LIMIT 1`,
        [g.tournament_id, g.id, sides],
      );
      if (busy) {
        const where = busy.table_name ?? busy.label;
        throw new FriendsError(
          409,
          `${await teamName(c, busy.team)} ${g.players_per_team > 1 ? "are" : "is"} still playing another match${where ? ` (${where})` : ""}. Finish that one first.`,
        );
      }
    }
    const table = typeof tableName === "string" ? tableName.replace(/\s+/g, " ").trim().slice(0, 40) || null : null;
    await c.query(
      `UPDATE friend_games SET status = 'in_progress', started_at = now(), table_name = $2 WHERE id = $1`,
      [gameId, table],
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
          `${g.name} has started${table ? ` on ${table}` : ""}.`,
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
export async function reportResult(
  gameId: string,
  actor: Actor,
  winnerTeamId: string,
  score?: Score | null,
) {
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
    const sc = scoreFor(g, winnerTeamId, score);

    // the other side is all guests: nobody there has an account to confirm
    // with, so the report stands (no points ride on a guest match anyway)
    const opposing = mine === g.team_a_id ? g.team_b_id : g.team_a_id;
    if ((await teamPlayerIds(c, opposing)).length === 0) {
      await finalizeGame(c, g, winnerTeamId, sc);
      return;
    }

    await c.query(
      `UPDATE friend_games
          SET result_status = 'reported', reported_winner_team_id = $2, reported_by = $3,
              reported_score_a = $4, reported_score_b = $5,
              status = 'in_progress', started_at = COALESCE(started_at, now())
        WHERE id = $1`,
      [gameId, winnerTeamId, actor.id, sc.a, sc.b],
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
        `${actor.nickname} says ${winName} won ${g.name}${scoreText(g, sc)}. Please confirm or dispute.`,
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
    await finalizeGame(
      c,
      g,
      g.reported_winner_team_id,
      g.reported_score_a != null && g.reported_score_b != null
        ? { a: g.reported_score_a, b: g.reported_score_b }
        : null,
    );
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
          SET result_status = 'disputed', reported_winner_team_id = NULL,
              reported_score_a = NULL, reported_score_b = NULL
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

/**
 * The organizer (or staff) marks the winner. Final at once — nobody has to
 * confirm. On a match that's already finished this CHANGES the result, and
 * everything that followed from it is corrected (see correctResult).
 */
export async function settleResult(
  gameId: string,
  actor: Actor,
  winnerTeamId: string,
  score?: Score | null,
) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can set or change a result.");
    if (g.is_bye) throw new FriendsError(400, "A BYE has no result.");
    if (winnerTeamId !== g.team_a_id && winnerTeamId !== g.team_b_id)
      throw new FriendsError(400, "Pick one of the two sides as the winner.");
    const sc = scoreFor(g, winnerTeamId, score);
    if (g.status === "completed") {
      if (g.winner_team_id === winnerTeamId) {
        if (g.score_a === sc.a && g.score_b === sc.b) return;
        // same winner, different scoreline — nothing moves but the score
        await c.query(`UPDATE friend_games SET score_a = $2, score_b = $3 WHERE id = $1`, [g.id, sc.a, sc.b]);
        await syncInhouseMatch(c, g.id);
        const batch = new Batch(c);
        await bumpGame(c, g.id);
        if (g.tournament_id) await bumpTournament(c, g.tournament_id);
        await touchGame(c, batch, g);
        await batch.flush();
        return;
      }
      await correctResult(c, g, winnerTeamId, actor, sc);
      return;
    }
    if (g.status !== "ready" && g.status !== "in_progress")
      throw new FriendsError(409, "This game isn't in play.");
    await finalizeGame(c, g, winnerTeamId, sc);
  });
}

/** organizer: take a finished match back to "not played yet" */
export async function undoResult(gameId: string, actor: Actor) {
  await transaction(async (c) => {
    const g = await lockGame(c, gameId);
    if (g.organizer_id !== actor.id && !isMod(actor))
      throw new FriendsError(403, "Only the organizer can undo a result.");
    if (g.is_bye) throw new FriendsError(400, "A BYE has no result.");
    if (g.status !== "completed" || !g.winner_team_id)
      throw new FriendsError(409, "This match has no result to undo.");
    await correctResult(c, g, null, actor);
  });
}

/**
 * Change (winner = the other side) or clear (winner = null) a finished
 * result, and repair what it fed into:
 *  · the next match / lower-bracket match get the right team (or none yet)
 *  · a league / group result after the table was settled rewinds the
 *    playoffs or tie-breakers — as long as none of those has been played
 *  · a finished tournament reopens; placement points are taken back and
 *    paid again when it finishes
 *  · this match's own points move to the right players
 * If a later match was already played with the old result, that one must be
 * undone first — we never guess how a match that didn't happen would have gone.
 */
async function correctResult(
  c: PoolClient,
  g: GameRow,
  winner: string | null,
  actor: Actor,
  score: Score | null = null,
) {
  const sc = winner ? (score ?? scoreFor(g, winner)) : null;
  const newLoser = winner ? (winner === g.team_a_id ? g.team_b_id : g.team_a_id) : null;
  const batch = new Batch(c);
  const href = g.tournament_id ? tournamentPath(g.tournament_id) : gamePath(g.id);
  const label = g.label ?? (g.tournament_id ? "match" : g.name);

  if (!g.tournament_id) {
    // ---- casual game: move the points ----
    await c.query(
      `DELETE FROM friend_points WHERE game_id = $1 AND reason IN ('game_win','game_loss')`,
      [g.id],
    );
    if (winner) {
      await c.query(`UPDATE friend_games SET winner_team_id = $2, score_a = $3, score_b = $4 WHERE id = $1`, [
        g.id,
        winner,
        sc!.a,
        sc!.b,
      ]);
      if (g.points_awarded) {
        await addPoints(c, await teamPlayerIds(c, winner), FRIEND_POINTS.gameWin, "game_win", { gameId: g.id });
        await addPoints(c, await teamPlayerIds(c, newLoser), FRIEND_POINTS.gameLoss, "game_loss", { gameId: g.id });
      }
    } else {
      await c.query(
        `UPDATE friend_games
            SET status = 'in_progress', winner_team_id = NULL, completed_at = NULL,
                score_a = NULL, score_b = NULL, reported_score_a = NULL, reported_score_b = NULL,
                result_status = 'none', reported_winner_team_id = NULL, points_awarded = false
          WHERE id = $1`,
        [g.id],
      );
    }
    await syncInhouseMatch(c, g.id);
    const msg = winner
      ? `${actor.nickname} changed the result of ${g.name}: ${await teamName(c, winner)} won.`
      : `${actor.nickname} took back the result of ${g.name} — it's open again.`;
    for (const pid of await playersOfGame(c, g.id)) if (pid !== actor.id) await batch.notify(pid, "result_changed", msg, href);
    await bumpGame(c, g.id);
    await touchGame(c, batch, g);
    await batch.flush();
    return;
  }

  // ---- tournament match ----
  const t = await lockTournament(c, g.tournament_id);
  if (t.status === "cancelled") throw new FriendsError(409, "This tournament was cancelled.");
  const all = (await c.query<GameRow>(`SELECT * FROM friend_games WHERE tournament_id = $1`, [t.id])).rows;
  const byId = new Map(all.map((x) => [x.id, x]));
  const where = (x: GameRow) => (x.group_no ? `${groupName(x.group_no)} · ` : "") + (x.label ?? "the next match");

  // later matches this one fed must not have been played yet
  for (const nextId of [g.next_game_id, g.loser_next_game_id]) {
    const nx = nextId ? byId.get(nextId) : null;
    if (nx && nx.status === "completed")
      throw new FriendsError(
        409,
        `${where(nx)} has already been played using this result. Undo that match first, then change this one.`,
      );
  }

  // a table result after the table was settled: rewind the second stage
  const tableMatch = g.stage === "league" || g.stage === "group";
  if (tableMatch && t.phase !== "main") {
    const later = all.filter((x) => ["playoff", "third_place", "decider"].includes(x.stage));
    const played = later.find((x) => x.status === "completed" && !x.is_bye);
    if (played)
      throw new FriendsError(
        409,
        `The ${played.stage === "decider" ? "tie-breaker" : "playoffs"} already started (${where(played)}). Undo those results first.`,
      );
    if (later.length) await c.query(`DELETE FROM friend_games WHERE id = ANY($1)`, [later.map((x) => x.id)]);
    await c.query(`UPDATE friend_tournaments SET phase = 'main', tiebreaks = '[]'::jsonb WHERE id = $1`, [t.id]);
  }

  // a finished tournament opens again; its placement points are paid again at the end
  if (t.status === "completed") {
    await c.query(
      `UPDATE friend_tournaments SET status = 'in_progress', champion_team_id = NULL, completed_at = NULL WHERE id = $1`,
      [t.id],
    );
    await c.query(
      `DELETE FROM friend_points WHERE tournament_id = $1 AND reason IN ('champion','runner_up','semi_finalist')`,
      [t.id],
    );
  }

  // the match itself
  if (winner) {
    await c.query(`UPDATE friend_games SET winner_team_id = $2, score_a = $3, score_b = $4 WHERE id = $1`, [
      g.id,
      winner,
      sc!.a,
      sc!.b,
    ]);
  } else {
    await c.query(
      `UPDATE friend_games
          SET status = 'ready', winner_team_id = NULL, completed_at = NULL,
              score_a = NULL, score_b = NULL, reported_score_a = NULL, reported_score_b = NULL,
              result_status = 'none', reported_winner_team_id = NULL, reported_by = NULL
        WHERE id = $1`,
      [g.id],
    );
  }

  await syncInhouseMatch(c, g.id);

  // what it fed: put the right team in (or empty the slot again)
  const live: TournamentRow = { ...t, status: "in_progress" };
  const reslot = async (nextId: string | null, slot: "a" | "b" | null, team: string | null) => {
    if (!nextId || !slot) return;
    const col = slot === "a" ? "team_a_id" : "team_b_id";
    // anything reported for the next match was about the old line-up
    await c.query(
      `UPDATE friend_games SET ${col} = NULL, status = 'waiting_for_players',
              result_status = 'none', reported_winner_team_id = NULL, reported_by = NULL,
              reported_score_a = NULL, reported_score_b = NULL,
              started_at = NULL, version = version + 1
        WHERE id = $1`,
      [nextId],
    );
    if (team) await fillSlot(c, batch, nextId, slot, team, live);
  };
  await reslot(g.next_game_id, g.next_slot, winner);
  await reslot(g.loser_next_game_id, g.loser_next_slot, newLoser);

  // this match's own points follow the result
  await c.query(`DELETE FROM friend_points WHERE game_id = $1 AND reason = 'match_win'`, [g.id]);
  if (winner && t.points_eligible) {
    const guest = (await teamHasGuest(c, winner)) || (await teamHasGuest(c, newLoser));
    if (!guest) {
      const amount = tableMatch ? FRIEND_POINTS.leagueMatchWin : FRIEND_POINTS.tournamentMatchWin;
      await addPoints(c, await teamPlayerIds(c, winner), amount, "match_win", { gameId: g.id, tournamentId: t.id });
    }
  }

  const players = uniq([
    ...(await teamPlayerIds(c, g.team_a_id)),
    ...(await teamPlayerIds(c, g.team_b_id)),
  ]);
  const msg = winner
    ? `${actor.nickname} changed the result of your ${label} match in ${t.name}: ${await teamName(c, winner)} won.`
    : `${actor.nickname} took back the result of your ${label} match in ${t.name} — it's open again.`;
  for (const pid of players) if (pid !== actor.id) await batch.notify(pid, "result_changed", msg, href);

  await progress(c, await lockTournament(c, t.id), batch);
  await bumpGame(c, g.id);
  await bumpTournament(c, t.id);
  await touchTournament(c, batch, t.id);
  await batch.flush();
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
async function finalizeGame(c: PoolClient, g: GameRow, winnerTeamId: string, score?: Score | null) {
  const sc = scoreFor(g, winnerTeamId, score);
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
            score_a = $3, score_b = $4, reported_score_a = NULL, reported_score_b = NULL,
            started_at = COALESCE(started_at, now())
      WHERE id = $1`,
    [g.id, winnerTeamId, sc.a, sc.b],
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
    await syncInhouseMatch(c, g.id);
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
  const href = tournamentPath(t.id);
  let label = g.label;
  if (!label) {
    const [{ rounds }] = await inTx(c)<{ rounds: number }>(
      `SELECT max(round)::int AS rounds FROM friend_games WHERE tournament_id = $1`,
      [t.id],
    );
    label = g.round ? roundName(g.round, rounds) : "match";
  }
  const where = (g.group_no ? `${groupName(g.group_no)} · ` : "") + label;

  // Guests keep the ledger honest: a match with a guest on either side pays nothing.
  const guestMatch =
    (await teamHasGuest(c, winnerTeamId)) || (await teamHasGuest(c, loserTeamId));
  if (t.points_eligible && !guestMatch) {
    const table = g.stage === "league" || g.stage === "group";
    await addPoints(
      c,
      winners,
      table ? FRIEND_POINTS.leagueMatchWin : FRIEND_POINTS.tournamentMatchWin,
      "match_win",
      { gameId: g.id, tournamentId: t.id },
    );
  }

  const advances = !!g.next_game_id;
  const dropsDown = !!g.loser_next_game_id;
  for (const pid of winners)
    await batch.notify(
      pid,
      "match_won",
      advances
        ? `You won your ${where} match in ${t.name} and go through.`
        : `You won your ${where} match in ${t.name}.`,
      href,
    );
  for (const pid of losers)
    await batch.notify(
      pid,
      "match_lost",
      dropsDown
        ? `${winName} won your ${where} match in ${t.name}. You drop into the lower bracket — still alive.`
        : `${winName} won your ${where} match in ${t.name}.`,
      href,
    );

  await syncInhouseMatch(c, g.id);
  if (g.next_game_id && g.next_slot)
    await fillSlot(c, batch, g.next_game_id, g.next_slot, winnerTeamId, t);
  if (g.loser_next_game_id && g.loser_next_slot && loserTeamId)
    await fillSlot(c, batch, g.loser_next_game_id, g.loser_next_slot, loserTeamId, t);

  await progress(c, await lockTournament(c, t.id), batch);
  await bumpGame(c, g.id);
  await bumpTournament(c, t.id);
  await touchTournament(c, batch, t.id);
  await batch.flush();
}

/* ------------------------ stage transitions ------------------------ */

/**
 * Run after every result (and after an organizer breaks a tie). Once nothing
 * is left to play in the current stage it moves the tournament on: tie-break
 * deciders, then playoffs, then completion. Safe to call any time — it does
 * nothing while matches are still open.
 */
async function progress(c: PoolClient, t: TournamentRow, batch: Batch) {
  if (t.status !== "in_progress") return;
  const games = (
    await c.query<GameRow>(`SELECT * FROM friend_games WHERE tournament_id = $1`, [t.id])
  ).rows;
  const open = (g: GameRow) =>
    g.status === "waiting_for_players" || g.status === "ready" || g.status === "in_progress";
  if (games.some(open)) return;

  const s = settingsOf(t);
  const href = tournamentPath(t.id);
  if ((t.kind === "league" || t.kind === "groups") && t.phase !== "playoffs") {
    const teams = await inTx(c)<{ id: string; seed: number | null }>(
      `SELECT id, seed FROM friend_teams WHERE tournament_id = $1 ORDER BY created_at, id`,
      [t.id],
    );
    const tables = buildTables(t, seedOrderOf(teams), games);
    const ties = tables.flatMap((tb) => blockingTies(tb.rows, tb.cuts, tb.group));

    if (ties.length) {
      await c.query(`UPDATE friend_tournaments SET phase = 'tiebreak' WHERE id = $1`, [t.id]);
      let round =
        Math.max(0, ...games.filter((g) => g.stage === "decider").map((g) => g.round ?? 0)) + 1;
      // Level players settle it at the table: a play-off where each plays each
      // other once (two players = one rematch). If they come out level again,
      // the next progress() call simply creates another play-off round.
      const tieBestOf = bestOfFor(s, { stage: "decider", label: "Tie-breaker" });
      for (const tie of ties) {
        const names: string[] = [];
        for (const x of tie.teamIds) names.push(await teamName(c, x));
        const thisRound = round++;
        const pairs: [string, string][] = [];
        for (let i = 0; i < tie.teamIds.length; i++)
          for (let j = i + 1; j < tie.teamIds.length; j++) pairs.push([tie.teamIds[i], tie.teamIds[j]]);
        for (const [position, [a, b]] of pairs.entries()) {
          await c.query(
            `INSERT INTO friend_games
               (id, name, organizer_id, format, players_per_team, status, tournament_id, round,
                position, team_a_id, team_b_id, stage, group_no, label, best_of)
             VALUES ($1,$2,$3,$4,$5,'ready',$6,$7,$8,$9,$10,'decider',$11,'Tie-breaker',$12)`,
            [nid("fg"), `${t.name} — Tie-breaker`, t.organizer_id, t.format, t.players_per_team,
             t.id, thisRound, position, a, b, tie.group, tieBestOf],
          );
        }
        const again = games.some(
          (g) => g.stage === "decider" && tie.teamIds.includes(g.team_a_id ?? "") && tie.teamIds.includes(g.team_b_id ?? ""),
        );
        const how =
          pairs.length === 1
            ? "A rematch decides it"
            : `Play-off: each of you plays the others once (${pairs.length} matches)`;
        for (const x of tie.teamIds)
          for (const pid of await teamPlayerIds(c, x))
            await batch.notify(
              pid,
              "match_ready",
              `${names.join(", ")} ${again ? "are still level" : "finished level on points"} in ${t.name}. ${how} — play your tie-breaker${pairs.length > 1 ? "s" : ""}.`,
              href,
            );
      }
      return;
    }

    if (hasPlayoffs(s)) {
      const plan = planPlayoffs(s, tables.map((tb) => tb.rows.map((r) => r.teamId)));
      await c.query(`UPDATE friend_tournaments SET phase = 'playoffs' WHERE id = $1`, [t.id]);
      await insertPlan(c, { ...t, phase: "playoffs" }, plan, batch);
      const through = new Set(plan.flatMap((g) => [g.a, g.b]).filter((x): x is string => !!x));
      for (const pid of uniq(await playersOfTournament(c, t.id))) {
        const mine = await inTx(c)<{ team_id: string }>(
          `SELECT team_id FROM friend_team_members WHERE tournament_id = $1 AND player_id = $2`,
          [t.id, pid],
        );
        const inIt = mine.some((m) => through.has(m.team_id));
        await batch.notify(
          pid,
          "playoffs_set",
          inIt
            ? `You made the ${t.kind === "league" ? "playoffs" : "knockout"} in ${t.name}! Your next match is ready.`
            : `The ${t.kind === "league" ? "playoffs" : "knockout"} in ${t.name} are set.`,
          href,
        );
      }
      return;
    }
  }
  await completeTournament(c, t, games, batch);
}

/** everything is played: record the winner, pay placement points, tell everyone */
async function completeTournament(c: PoolClient, t: TournamentRow, games: GameRow[], batch: Batch) {
  const teams = await inTx(c)<{ id: string; seed: number | null }>(
    `SELECT id, seed FROM friend_teams WHERE tournament_id = $1 ORDER BY created_at, id`,
    [t.id],
  );
  const done: TournamentRow = { ...t, status: "completed" };
  const p = placementsFrom(done, games, buildTables(done, seedOrderOf(teams), games));
  await c.query(
    `UPDATE friend_tournaments
        SET status = 'completed', champion_team_id = $2, completed_at = now()
      WHERE id = $1`,
    [t.id, p.champion],
  );

  const [{ n: guests }] = await inTx(c)<{ n: number }>(
    `SELECT count(*)::int AS n FROM friend_team_guests WHERE tournament_id = $1`,
    [t.id],
  );
  if (t.points_eligible && guests === 0) {
    const ctx = { tournamentId: t.id };
    const champs = [p.champion, ...p.groupWinners.map((w) => w.teamId)].filter((x): x is string => !!x);
    for (const team of champs)
      await addPoints(c, await teamPlayerIds(c, team), FRIEND_POINTS.champion, "champion", ctx);
    if (p.runnerUp)
      await addPoints(c, await teamPlayerIds(c, p.runnerUp), FRIEND_POINTS.runnerUp, "runner_up", ctx);
    for (const team of p.semis)
      await addPoints(c, await teamPlayerIds(c, team), FRIEND_POINTS.semiFinalist, "semi_finalist", ctx);
  }

  const href = tournamentPath(t.id);
  let message: string;
  if (p.groupWinners.length) {
    // one client can only run one query at a time — so one by one
    const names: string[] = [];
    for (const w of p.groupWinners) names.push(`${groupName(w.group)}: ${await teamName(c, w.teamId)}`);
    message = `${t.name} is over. Group winners — ${names.join(" · ")}.`;
  } else if (p.champion) {
    message = `${t.name} is over. ${await teamName(c, p.champion)} won it!`;
  } else message = `${t.name} is over.`;
  for (const pid of uniq(await playersOfTournament(c, t.id)))
    await batch.notify(pid, "tournament_done", message, href);
  if (!(await playersOfTournament(c, t.id)).includes(t.organizer_id))
    await batch.notify(t.organizer_id, "tournament_done", message, href);
}

/** write a plan's matches; first-round BYEs go straight through */
async function insertPlan(c: PoolClient, t: TournamentRow, plan: PlanGame<string>[], batch: Batch) {
  const ids = new Map(plan.map((g) => [g.key, nid("fg")]));
  const s = settingsOf(t);
  for (const g of plan) {
    const both = g.a !== null && g.b !== null;
    await c.query(
      `INSERT INTO friend_games
         (id, name, organizer_id, format, players_per_team, status, tournament_id, round, position,
          next_game_id, next_slot, is_bye, team_a_id, team_b_id, winner_team_id, completed_at,
          stage, group_no, label, loser_next_game_id, loser_next_slot, due_date, best_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        ids.get(g.key),
        `${t.name} — ${g.group ? `${groupName(g.group)} · ` : ""}${g.label}`,
        t.organizer_id,
        t.format,
        t.players_per_team,
        g.isBye ? "completed" : both ? "ready" : "waiting_for_players",
        t.id,
        g.round,
        g.position,
        g.winnerTo ? ids.get(g.winnerTo.key) : null,
        g.winnerTo?.slot ?? null,
        g.isBye,
        g.a,
        g.b,
        g.isBye ? (g.a ?? g.b) : null,
        g.isBye ? new Date() : null,
        g.stage,
        g.group,
        g.label,
        g.loserTo ? ids.get(g.loserTo.key) : null,
        g.loserTo?.slot ?? null,
        g.dueDate,
        bestOfFor(s, g),
      ],
    );
  }
  const live: TournamentRow = { ...t, status: "in_progress" };
  for (const g of plan.filter((x) => x.isBye && x.winnerTo))
    await fillSlot(c, batch, ids.get(g.winnerTo!.key)!, g.winnerTo!.slot, (g.a ?? g.b)!, live);
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

/** one entry as the organizer builds it: registered players and/or named guests */
export interface TeamInput {
  playerIds: string[];
  guests: string[];
}

async function checkGuestNames(c: PoolClient, t: TournamentRow, names: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  if (uniq(lower).length !== lower.length)
    throw new FriendsError(400, "Two guests can't share the same name.");
  if (!names.length) return;
  const [clash] = await inTx(c)<{ name: string }>(
    `SELECT name FROM friend_team_guests WHERE tournament_id = $1 AND lower(name) = ANY($2)`,
    [t.id, lower],
  );
  if (clash)
    throw new FriendsError(
      409,
      `There is already a guest called ${clash.name} in this tournament. Use a different name.`,
    );
}

async function insertGuest(
  c: PoolClient,
  t: TournamentRow,
  teamId: string,
  name: string,
  actor: Actor,
) {
  await c.query(
    `INSERT INTO friend_team_guests (id, team_id, tournament_id, name, added_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [nid("fgu"), teamId, t.id, name, actor.id],
  );
}

/** validates a new entry; returns the cleaned guest names */
async function checkNewTeam(
  c: PoolClient,
  t: TournamentRow,
  playerIds: string[],
  guestNames: string[] = [],
): Promise<string[]> {
  const f = FORMATS[t.format];
  const ids = uniq(playerIds);
  if (ids.length !== playerIds.length)
    throw new FriendsError(400, "A player can't be on the same team twice.");
  const guests = guestNames.map(cleanGuestName);
  const sizeErr = validateTeamSize(f, ids.length + guests.length);
  if (sizeErr) throw new FriendsError(400, sizeErr);
  await checkGuestNames(c, t, guests);
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
  return guests;
}

async function insertTeam(
  c: PoolClient,
  batch: Batch,
  t: TournamentRow,
  playerIds: string[],
  actor: Actor,
  guests: string[] = [],
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
  for (const name of guests) await insertGuest(c, t, teamId, name, actor);
  return teamId;
}

export async function createTournament(
  actor: Actor,
  input: {
    name?: string;
    format: unknown;
    capacityTeams: unknown;
    seeding?: unknown;
    teams?: TeamInput[];
    settings?: unknown;
  },
): Promise<string> {
  if (actor.role !== "player") throw new FriendsError(403, "Only players can create tournaments.");
  if (!isFormat(input.format)) throw new FriendsError(400, "Choose 1v1 or 2v2.");
  const f = FORMATS[input.format];
  const capacity = Number(input.capacityTeams);
  if (!isValidTournamentSize(capacity))
    throw new FriendsError(
      400,
      `Choose between ${MIN_TEAMS_TO_START} and ${MAX_TOURNAMENT_TEAMS} entries.`,
    );
  const seeding = input.seeding === "ranking" ? "ranking" : "random";
  const settings = normalizeSettings(input.settings);
  const formatProblem = validateSettings(settings, capacity);
  if (formatProblem) throw new FriendsError(400, formatProblem);
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
         (id, name, organizer_id, format, players_per_team, capacity_teams, seeding, kind, settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, name, actor.id, f.code, f.playersPerTeam, capacity, seeding, settings.kind, JSON.stringify(settings)],
    );
    const t = await lockTournament(c, id);
    const batch = new Batch(c);
    for (const team of teams) {
      const guests = await checkNewTeam(c, t, team.playerIds, team.guests);
      await insertTeam(c, batch, t, team.playerIds, actor, guests);
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

/** organizer adds a team (1 player for 1v1, 2 for 2v2) — registered players and/or guests */
export async function addTeam(
  tournamentId: string,
  actor: Actor,
  playerIds: string[],
  guestNames: string[] = [],
) {
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
    const guests = await checkNewTeam(c, t, playerIds, guestNames);
    const batch = new Batch(c);
    await insertTeam(c, batch, t, playerIds, actor, guests);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** fill an open seat on a team with a guest (a name, no account) */
export async function addTeamGuest(
  tournamentId: string,
  actor: Actor,
  teamId: string,
  rawName: string,
) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const name = cleanGuestName(rawName);
    const [team] = await inTx(c)<{ id: string; n: number }>(
      `SELECT ft.id,
              ((SELECT count(*) FROM friend_team_members m WHERE m.team_id = ft.id)
             + (SELECT count(*) FROM friend_team_guests gg WHERE gg.team_id = ft.id))::int AS n
         FROM friend_teams ft WHERE ft.id = $1 AND ft.tournament_id = $2`,
      [teamId, tournamentId],
    );
    if (!team) throw new FriendsError(404, "Team not found.");
    if (team.n >= t.players_per_team)
      throw new FriendsError(409, `A ${t.format} team must contain exactly ${t.players_per_team} players.`);
    await checkGuestNames(c, t, [name]);
    await insertGuest(c, t, teamId, name, actor);
    const batch = new Batch(c);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** organizer removes a guest (an entry left with nobody on it goes too) */
export async function removeTournamentGuest(tournamentId: string, actor: Actor, guestId: string) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const res = await c.query(
      `DELETE FROM friend_team_guests WHERE id = $1 AND tournament_id = $2`,
      [guestId, tournamentId],
    );
    if (!res.rowCount) throw new FriendsError(404, "That guest is not in this tournament.");
    await dropEmptyTeams(c, tournamentId);
    const batch = new Batch(c);
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
      `SELECT ft.id,
              ((SELECT count(*) FROM friend_team_members m WHERE m.team_id = ft.id)
             + (SELECT count(*) FROM friend_team_guests gg WHERE gg.team_id = ft.id))::int AS n
         FROM friend_teams ft WHERE ft.id = $1 AND ft.tournament_id = $2`,
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
    await dropEmptyTeams(c, tournamentId);
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
      await dropEmptyTeams(c, tournamentId);
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
    const s = settingsOf(t);
    const problem = validateSettings(s, complete.length);
    if (problem)
      throw new FriendsError(
        400,
        `${problem} With ${complete.length} complete ${noun}, change the format or add more ${noun}.`,
      );
    const preview = planMain(s, complete.map((x) => x.id));
    const byes = preview.filter((g) => g.isBye).length;
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
      for (const m of team.members.filter((x) => !x.guest))
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
    // a weekly schedule with no start date starts this week
    const plan = planMain(
      s.schedule === "weekly" && !s.startDate ? { ...s, startDate: todayIso() } : s,
      seeded,
    );
    await insertPlan(c, { ...t, status: "in_progress" }, plan, batch);

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
        startMessage(t),
        tournamentPath(t.id),
      );
    await bumpTournament(c, t.id);
    await touchTournament(c, batch, t.id);
    for (const team of incomplete)
      for (const m of team.members.filter((x) => !x.guest)) batch.touch(`user:${m.id}`);
    await batch.flush();
  });
}

function startMessage(t: TournamentRow): string {
  switch (t.kind) {
    case "league":
      return `${t.name} has started — the fixtures are out. Play your league matches.`;
    case "groups":
      return `${t.name} has started — the groups are drawn. Play your group matches.`;
    case "double_elim":
      return `${t.name} has started — the bracket is live. Lose twice and you're out.`;
    default:
      return `${t.name} has started — the bracket is live.`;
  }
}

/** organizer changes the format (and its options) while registration is open */
export async function updateTournamentFormat(tournamentId: string, actor: Actor, raw: unknown) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    assertOpen(t);
    const s = normalizeSettings(raw);
    const problem = validateSettings(s, t.capacity_teams);
    if (problem) throw new FriendsError(400, problem);
    await c.query(`UPDATE friend_tournaments SET kind = $2, settings = $3 WHERE id = $1`, [
      tournamentId,
      s.kind,
      JSON.stringify(s),
    ]);
    const batch = new Batch(c);
    await bumpTournament(c, tournamentId);
    await touchTournament(c, batch, tournamentId);
    await batch.flush();
  });
}

/** step 1 of cancelling: a one-time code the organizer must type back */
export async function requestTournamentCancelCode(tournamentId: string, actor: Actor): Promise<string> {
  return transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    if (t.status !== "registration_open" && t.status !== "in_progress")
      throw new FriendsError(409, "This tournament is already finished.");
    const { code, hash, expires } = newCancelCode();
    await c.query(
      `UPDATE friend_tournaments SET cancel_code_hash = $2, cancel_code_expires = $3 WHERE id = $1`,
      [t.id, hash, expires],
    );
    return code;
  });
}

/** step 2: cancel — only with the code from step 1 */
export async function cancelTournament(tournamentId: string, actor: Actor, code?: unknown) {
  await transaction(async (c) => {
    const t = await lockTournament(c, tournamentId);
    assertOrganizer(t, actor);
    if (t.status !== "registration_open" && t.status !== "in_progress")
      throw new FriendsError(409, "This tournament is already finished.");
    if (!cancelCodeOk(code, t.cancel_code_hash, t.cancel_code_expires))
      throw new FriendsError(400, "That code doesn't match or has expired. Get a new code and try again.");
    await c.query(
      `UPDATE friend_tournaments SET cancel_code_hash = NULL, cancel_code_expires = NULL WHERE id = $1`,
      [t.id],
    );
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

