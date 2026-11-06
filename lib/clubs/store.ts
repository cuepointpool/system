/* ============================================================
   Partner clubs (e.g. Infinity Pool Club).

   · A Cue Point admin creates the club and gives it an admin username +
     password. The club admin signs in at /clubs/admin (separate `cp_club`
     cookie — never a player session).
   · Members are ordinary Cue Point player accounts the club admin adds
     and places in a group (group 1 = the top / "Pro" group).
   · Every week the club starts a league in every group (the friend-
     tournament engine, organizer = the club's hidden host profile). When
     the week is over, the moves (lib/clubs/regroup.ts) are previewed,
     applied, and the next week can start.
   ============================================================ */

import { cookies } from "next/headers";
import { CLUB_COOKIE, createSessionToken, hashPassword, readSession, verifyPassword } from "../auth";
import { query, queryOne, transaction } from "../pg";
import { clubFinishOrder, createClubLeagues, type Actor } from "../friends/store";
import { normalizeSettings, type TournamentSettings } from "../friends/structure";
import { groupLabel, MAX_CLUB_GROUPS, planMoves, type Move } from "./regroup";

export class ClubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ClubRow {
  id: string;
  slug: string;
  name: string;
  host_id: string;
  username: string | null;
  password_hash: string | null;
  session_version: number;
  active: boolean;
  group_count: number;
  group_names: string[] | null;
  move_count: number | null;
  league_settings: Partial<TournamentSettings> | null;
  moves_applied_week: number;
  last_moves: LastMoves | null;
  created_at: Date;
}

export interface ClubAccount {
  id: string;
  slug: string;
  name: string;
  hostId: string;
  username: string | null;
  hasLogin: boolean;
  active: boolean;
  sessionVersion: number;
  members: number;
}

const toAccount = (r: ClubRow, members = 0): ClubAccount => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  hostId: r.host_id,
  username: r.username,
  hasLogin: !!r.username && !!r.password_hash,
  active: r.active,
  sessionVersion: Number(r.session_version ?? 0),
  members,
});

const rid = () => globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "club";

const cleanText = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function cleanUsername(v: unknown): string {
  const u = String(v ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(u))
    throw new ClubError(400, "Username: 3–32 letters, numbers, dots, dashes or underscores.");
  return u;
}
function checkPassword(v: unknown): string {
  const p = String(v ?? "");
  if (p.length < 8 || p.length > 200) throw new ClubError(400, "Password must be at least 8 characters.");
  return p;
}

async function clubRow(id: string): Promise<ClubRow> {
  const r = await queryOne<ClubRow>(`SELECT * FROM clubs WHERE id = $1`, [id]);
  if (!r) throw new ClubError(404, "Club not found");
  return r;
}

/* ------------------------------ admin side ------------------------------ */

export async function listClubs(): Promise<ClubAccount[]> {
  const rows = await query<ClubRow & { members: number }>(
    `SELECT c.*, (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.id) AS members
       FROM clubs c ORDER BY c.created_at`,
  );
  return rows.map((r) => toAccount(r, r.members));
}

/** active clubs for the public /clubs page */
export async function listPublicClubs(): Promise<{ slug: string; name: string; members: number; groups: number; week: number }[]> {
  const rows = await query<{ slug: string; name: string; members: number; groups: number; week: number | null }>(
    `SELECT c.slug, c.name, c.group_count AS groups,
            (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.id) AS members,
            (SELECT max(t.club_week) FROM friend_tournaments t WHERE t.club_id = c.id) AS week
       FROM clubs c WHERE c.active ORDER BY c.name`,
  );
  return rows.map((r) => ({ ...r, week: Number(r.week ?? 0) }));
}

/** Cue Point admin: a new club with its admin login */
export async function createClub(input: { name: unknown; username: unknown; password: unknown }): Promise<ClubAccount> {
  const name = cleanText(input.name, 60);
  if (name.length < 2) throw new ClubError(400, "Enter the club's name.");
  const username = cleanUsername(input.username);
  const password = checkPassword(input.password);
  return transaction(async (c) => {
    const taken = await c.query(`SELECT 1 FROM clubs WHERE lower(username) = $1`, [username]);
    if (taken.rowCount) throw new ClubError(409, "That username is already used by another club.");
    // "/clubs/admin" is the sign-in page, so no club may be called that
    const base = slugify(name) === "admin" ? "admin-club" : slugify(name);
    let slug = base;
    for (let i = 2; (await c.query(`SELECT 1 FROM clubs WHERE slug = $1`, [slug])).rowCount; i++) slug = `${base}-${i}`;
    // the club's hidden host profile: organizer of its tournaments, can't sign in
    const hostId = "p_" + rid();
    let hostSlug = `club-${slug}`;
    for (let i = 2; (await c.query(`SELECT 1 FROM player_profiles WHERE slug = $1`, [hostSlug])).rowCount; i++)
      hostSlug = `club-${slug}-${i}`;
    await c.query(
      `INSERT INTO player_profiles (id, slug, full_name, nickname, role) VALUES ($1,$2,$3,$3,'club')`,
      [hostId, hostSlug, name],
    );
    const id = "club_" + rid();
    const r = await c.query<ClubRow>(
      `INSERT INTO clubs (id, slug, name, host_id, username, password_hash, league_settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, slug, name, hostId, username, hashPassword(password), JSON.stringify(normalizeSettings({ kind: "league" }))],
    );
    return toAccount(r.rows[0]);
  });
}

/** Cue Point admin: rename, change the login, switch the club off/on */
export async function updateClubLogin(
  id: string,
  input: { name?: unknown; username?: unknown; password?: unknown; active?: unknown },
): Promise<void> {
  const r = await clubRow(id);
  if (input.name !== undefined) {
    const name = cleanText(input.name, 60);
    if (name.length < 2) throw new ClubError(400, "Enter the club's name.");
    await query(`UPDATE clubs SET name = $2 WHERE id = $1`, [id, name]);
    await query(`UPDATE player_profiles SET full_name = $2, nickname = $2 WHERE id = $1`, [r.host_id, name]);
  }
  if (input.username !== undefined) {
    const u = cleanUsername(input.username);
    const taken = await queryOne(`SELECT 1 FROM clubs WHERE lower(username) = $1 AND id <> $2`, [u, id]);
    if (taken) throw new ClubError(409, "That username is already used by another club.");
    await query(`UPDATE clubs SET username = $2 WHERE id = $1`, [id, u]);
  }
  if (input.password !== undefined && input.password !== "") {
    const p = checkPassword(input.password);
    // a new password signs the old one out everywhere
    await query(`UPDATE clubs SET password_hash = $2, session_version = session_version + 1 WHERE id = $1`, [
      id,
      hashPassword(p),
    ]);
  }
  if (typeof input.active === "boolean")
    await query(`UPDATE clubs SET active = $2, session_version = session_version + 1 WHERE id = $1`, [id, input.active]);
}

/* ------------------------------ club session ----------------------------- */

export async function verifyClubLogin(username: string, password: string): Promise<ClubAccount | null> {
  const r = await queryOne<ClubRow>(`SELECT * FROM clubs WHERE lower(username) = lower($1)`, [username.trim()]);
  if (!r || !r.active || !r.password_hash) return null;
  if (!verifyPassword(password, r.password_hash)) return null;
  return toAccount(r);
}

export const clubSessionToken = (a: ClubAccount) => createSessionToken(a.id, a.sessionVersion);

/** the club whose admin is signed in on this browser (cp_club cookie) */
export async function clubViewer(): Promise<ClubAccount | null> {
  const store = await cookies();
  const s = readSession(store.get(CLUB_COOKIE)?.value);
  if (!s || !s.id.startsWith("club_")) return null;
  const r = await queryOne<ClubRow>(`SELECT * FROM clubs WHERE id = $1`, [s.id]);
  if (!r || !r.active || Number(r.session_version) !== s.version) return null;
  return toAccount(r);
}

/** the tournament-engine identity of a signed-in club admin */
export const clubActor = (a: ClubAccount): Actor => ({ id: a.hostId, role: "club", nickname: a.name });

/* ------------------------------ dashboard ------------------------------ */

export interface ClubMemberView {
  id: string;
  slug: string;
  nickname: string;
  fullName: string;
  avatar: string | null;
  group: number;
  joinedAt: string;
}

export interface ClubTournamentRef {
  id: string;
  name: string;
  group: number;
  groupName: string;
  status: string;
  champion: string | null;
  players: number;
  /** matches played / total (BYEs left out) */
  played: number;
  total: number;
}

export interface ClubWeek {
  week: number;
  tournaments: ClubTournamentRef[];
  /** every league of the week has finished or was cancelled */
  done: boolean;
}

export interface ClubView {
  id: string;
  slug: string;
  name: string;
  groupCount: number;
  groups: { group: number; name: string; members: ClubMemberView[] }[];
  moveCount: number | null;
  leagueSettings: TournamentSettings;
  weeks: ClubWeek[];
  /** next week's number */
  nextWeek: number;
  /** a week is being played right now */
  running: boolean;
  /** what the system moved after the last finished week (undo-able) */
  lastMoves: LastMoves | null;
}

/** players the system moved between groups after a finished week */
export interface LastMoves {
  week: number;
  moves: (Move & { nickname: string })[];
  undone?: boolean;
}

/** a club league's club page address, if this tournament is one */
export async function clubSlugOfTournament(tournamentId: string): Promise<string | null> {
  const r = await queryOne<{ slug: string }>(
    `SELECT c.slug FROM friend_tournaments t JOIN clubs c ON c.id = t.club_id WHERE t.id = $1`,
    [tournamentId],
  );
  return r?.slug ?? null;
}

export async function getClubIdBySlug(slug: string): Promise<string | null> {
  const r = await queryOne<{ id: string }>(`SELECT id FROM clubs WHERE slug = $1 AND active`, [slug]);
  return r?.id ?? null;
}

async function loadMembers(clubId: string): Promise<ClubMemberView[]> {
  const rows = await query<{
    id: string;
    slug: string;
    nickname: string;
    full_name: string;
    avatar: string | null;
    group_no: number;
    joined_at: Date;
  }>(
    `SELECT p.id, p.slug, p.nickname, p.full_name, p.avatar, m.group_no, m.joined_at
       FROM club_members m JOIN player_profiles p ON p.id = m.player_id
      WHERE m.club_id = $1
      ORDER BY m.group_no, lower(p.nickname)`,
    [clubId],
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nickname: r.nickname,
    fullName: r.full_name,
    avatar: r.avatar,
    group: r.group_no,
    joinedAt: new Date(r.joined_at).toISOString(),
  }));
}

async function loadWeeks(r: ClubRow): Promise<ClubWeek[]> {
  const rows = await query<{
    id: string;
    name: string;
    club_week: number;
    club_group: number;
    status: string;
    champion: string | null;
    players: number;
    played: number;
    total: number;
  }>(
    `SELECT t.id, t.name, t.club_week, t.club_group, t.status,
            (SELECT p.nickname FROM friend_team_members m JOIN player_profiles p ON p.id = m.player_id
              WHERE m.team_id = t.champion_team_id LIMIT 1) AS champion,
            (SELECT count(*)::int FROM friend_team_members m WHERE m.tournament_id = t.id) AS players,
            (SELECT count(*)::int FROM friend_games g WHERE g.tournament_id = t.id AND NOT g.is_bye
                AND g.status = 'completed') AS played,
            (SELECT count(*)::int FROM friend_games g WHERE g.tournament_id = t.id AND NOT g.is_bye
                AND g.status <> 'cancelled') AS total
       FROM friend_tournaments t
      WHERE t.club_id = $1
      ORDER BY t.club_week DESC, t.club_group`,
    [r.id],
  );
  const weeks = new Map<number, ClubTournamentRef[]>();
  for (const x of rows) {
    const list = weeks.get(x.club_week) ?? [];
    list.push({
      id: x.id,
      name: x.name,
      group: x.club_group,
      groupName: groupLabel(r.group_names ?? [], x.club_group),
      status: x.status,
      champion: x.champion,
      players: x.players,
      played: x.played,
      total: x.total,
    });
    weeks.set(x.club_week, list);
  }
  return [...weeks.entries()].map(([week, tournaments]) => ({
    week,
    tournaments,
    done: tournaments.every((t) => t.status === "completed" || t.status === "cancelled"),
  }));
}

async function proposal(r: ClubRow, members: ClubMemberView[], last: ClubWeek | undefined): Promise<Move[]> {
  if (!last || !last.done) return [];
  const orders = new Map<number, string[] | null>();
  for (const t of last.tournaments) orders.set(t.group, await clubFinishOrder(t.id));
  return planMoves(
    Array.from({ length: r.group_count }, (_, i) => i + 1).map((group) => ({
      group,
      members: members.filter((m) => m.group === group).map((m) => m.id),
      order: orders.get(group) ?? null,
    })),
    r.move_count,
  );
}

/**
 * The club with everything its pages need. Once every league of the latest
 * week is finished, the groups are re-made automatically (bottom players
 * down, top players up) — exactly once per week, whoever looks first.
 */
export async function getClubView(clubId: string): Promise<ClubView> {
  await autoRegroup(clubId);
  return buildView(await clubRow(clubId));
}

async function buildView(r: ClubRow): Promise<ClubView> {
  const [members, weeks] = await Promise.all([loadMembers(r.id), loadWeeks(r)]);
  const last = weeks[0];
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    groupCount: r.group_count,
    groups: Array.from({ length: r.group_count }, (_, i) => i + 1).map((group) => ({
      group,
      name: groupLabel(r.group_names ?? [], group),
      members: members.filter((m) => m.group === group),
    })),
    moveCount: r.move_count,
    leagueSettings: normalizeSettings({ ...(r.league_settings ?? {}), kind: "league" }),
    weeks,
    nextWeek: (last?.week ?? 0) + 1,
    running: !!last && !last.done,
    lastMoves: r.last_moves && last && r.last_moves.week === last.week ? r.last_moves : null,
  };
}

/** apply the finished week's moves if that hasn't happened yet; true if it did */
export async function autoRegroup(clubId: string): Promise<boolean> {
  const r = await clubRow(clubId);
  const weeks = await loadWeeks(r);
  const last = weeks[0];
  if (!last || !last.done || r.moves_applied_week >= last.week) return false;
  if (!last.tournaments.some((t) => t.status === "completed")) return false; // whole week cancelled
  const members = await loadMembers(clubId);
  const moves = await proposal(r, members, last);
  const nick = new Map(members.map((m) => [m.id, m.nickname]));
  return transaction(async (c) => {
    const locked = (await c.query<ClubRow>(`SELECT * FROM clubs WHERE id = $1 FOR UPDATE`, [clubId])).rows[0];
    if (locked.moves_applied_week >= last.week) return false; // someone else just did it
    for (const m of moves)
      await c.query(
        `UPDATE club_members SET group_no = $3 WHERE club_id = $1 AND player_id = $2 AND group_no = $4`,
        [clubId, m.playerId, m.to, m.from],
      );
    const record: LastMoves = {
      week: last.week,
      moves: moves.map((m) => ({ ...m, nickname: nick.get(m.playerId) ?? "Player" })),
    };
    await c.query(`UPDATE clubs SET moves_applied_week = $2, last_moves = $3 WHERE id = $1`, [
      clubId,
      last.week,
      JSON.stringify(record),
    ]);
    return true;
  });
}

/** after a result: if it finished a club week, regroup now */
export async function regroupAfterGame(gameId: string): Promise<void> {
  const r = await queryOne<{ club_id: string }>(
    `SELECT t.club_id FROM friend_games g JOIN friend_tournaments t ON t.id = g.tournament_id
      WHERE g.id = $1 AND t.club_id IS NOT NULL`,
    [gameId],
  );
  if (r) await autoRegroup(r.club_id).catch((e) => console.error("[club] regroup failed", e));
}

/** clubs a player belongs to (for their profile / dashboard) */
export async function clubsOfPlayer(playerId: string): Promise<{ slug: string; name: string; group: string }[]> {
  const rows = await query<{ slug: string; name: string; group_no: number; group_names: string[] | null }>(
    `SELECT c.slug, c.name, m.group_no, c.group_names FROM club_members m JOIN clubs c ON c.id = m.club_id
      WHERE m.player_id = $1 AND c.active ORDER BY c.name`,
    [playerId],
  );
  return rows.map((r) => ({ slug: r.slug, name: r.name, group: groupLabel(r.group_names ?? [], r.group_no) }));
}

/* ------------------------------ club admin actions ------------------------------ */

function checkGroup(r: ClubRow, g: unknown): number {
  const n = Math.trunc(Number(g));
  if (!Number.isInteger(n) || n < 1 || n > r.group_count) throw new ClubError(400, "Choose a group.");
  return n;
}

export async function addMember(clubId: string, playerId: string, group: unknown): Promise<void> {
  const r = await clubRow(clubId);
  const g = checkGroup(r, group);
  const p = await queryOne<{ role: string }>(`SELECT role FROM player_profiles WHERE id = $1`, [playerId]);
  if (!p || p.role !== "player") throw new ClubError(400, "Only registered Cue Point players can join a club.");
  const res = await query(
    `INSERT INTO club_members (club_id, player_id, group_no) VALUES ($1,$2,$3)
     ON CONFLICT (club_id, player_id) DO NOTHING RETURNING 1`,
    [clubId, playerId, g],
  );
  if (!res.length) throw new ClubError(409, "That player is already in the club.");
}

export async function moveMember(clubId: string, playerId: string, group: unknown): Promise<void> {
  const r = await clubRow(clubId);
  const g = checkGroup(r, group);
  const res = await query(`UPDATE club_members SET group_no = $3 WHERE club_id = $1 AND player_id = $2 RETURNING 1`, [
    clubId,
    playerId,
    g,
  ]);
  if (!res.length) throw new ClubError(404, "That player isn't in the club.");
}

export async function removeMember(clubId: string, playerId: string): Promise<void> {
  await query(`DELETE FROM club_members WHERE club_id = $1 AND player_id = $2`, [clubId, playerId]);
}

/** how many groups, their names, how many move each week, the league rules */
export async function updateClubSettings(
  clubId: string,
  input: { groupCount?: unknown; groupNames?: unknown; moveCount?: unknown; leagueSettings?: unknown },
): Promise<void> {
  await transaction(async (c) => {
    const r = (await c.query<ClubRow>(`SELECT * FROM clubs WHERE id = $1 FOR UPDATE`, [clubId])).rows[0];
    if (!r) throw new ClubError(404, "Club not found");
    if (input.groupCount !== undefined) {
      const n = Math.trunc(Number(input.groupCount));
      if (!Number.isInteger(n) || n < 1 || n > MAX_CLUB_GROUPS)
        throw new ClubError(400, `Between 1 and ${MAX_CLUB_GROUPS} groups.`);
      await c.query(`UPDATE clubs SET group_count = $2 WHERE id = $1`, [clubId, n]);
      // groups that were removed: their players go to the (new) bottom group
      await c.query(`UPDATE club_members SET group_no = $2 WHERE club_id = $1 AND group_no > $2`, [clubId, n]);
    }
    if (input.groupNames !== undefined) {
      if (!Array.isArray(input.groupNames)) throw new ClubError(400, "Group names must be a list.");
      const names = input.groupNames.slice(0, MAX_CLUB_GROUPS).map((x) => cleanText(x, 30));
      await c.query(`UPDATE clubs SET group_names = $2 WHERE id = $1`, [clubId, JSON.stringify(names)]);
    }
    if (input.moveCount !== undefined) {
      const v = input.moveCount;
      const n = v === null || v === "" || v === "half" ? null : Math.trunc(Number(v));
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 50)) throw new ClubError(400, "Enter 0–50 players.");
      await c.query(`UPDATE clubs SET move_count = $2 WHERE id = $1`, [clubId, n]);
    }
    if (input.leagueSettings !== undefined) {
      const s = normalizeSettings({ ...(input.leagueSettings as object), kind: "league" });
      await c.query(`UPDATE clubs SET league_settings = $2 WHERE id = $1`, [clubId, JSON.stringify(s)]);
    }
  });
}

/** put everyone the system moved after the last week back where they were */
export async function undoLastMoves(clubId: string): Promise<number> {
  return transaction(async (c) => {
    const r = (await c.query<ClubRow>(`SELECT * FROM clubs WHERE id = $1 FOR UPDATE`, [clubId])).rows[0];
    if (!r) throw new ClubError(404, "Club not found");
    const lm = r.last_moves;
    if (!lm || lm.undone || !lm.moves.length) throw new ClubError(409, "There are no automatic moves to undo.");
    const started = await c.query(`SELECT 1 FROM friend_tournaments WHERE club_id = $1 AND club_week > $2`, [
      clubId,
      lm.week,
    ]);
    if (started.rowCount) throw new ClubError(409, "The next week has already started.");
    let n = 0;
    for (const m of lm.moves) {
      // only players still where the system put them
      const res = await c.query(
        `UPDATE club_members SET group_no = $3 WHERE club_id = $1 AND player_id = $2 AND group_no = $4`,
        [clubId, m.playerId, m.from, m.to],
      );
      n += res.rowCount ?? 0;
    }
    await c.query(`UPDATE clubs SET last_moves = $2 WHERE id = $1`, [clubId, JSON.stringify({ ...lm, undone: true })]);
    return n;
  });
}

/** swap two players between their groups */
export async function swapMembers(clubId: string, a: string, b: string): Promise<void> {
  if (!a || !b || a === b) throw new ClubError(400, "Choose two different players.");
  await transaction(async (c) => {
    const rows = (
      await c.query<{ player_id: string; group_no: number }>(
        `SELECT player_id, group_no FROM club_members WHERE club_id = $1 AND player_id = ANY($2) FOR UPDATE`,
        [clubId, [a, b]],
      )
    ).rows;
    if (rows.length !== 2) throw new ClubError(404, "Both players must be in the club.");
    const [x, y] = rows;
    if (x.group_no === y.group_no) throw new ClubError(400, "They're already in the same group.");
    await c.query(`UPDATE club_members SET group_no = $3 WHERE club_id = $1 AND player_id = $2`, [clubId, x.player_id, y.group_no]);
    await c.query(`UPDATE club_members SET group_no = $3 WHERE club_id = $1 AND player_id = $2`, [clubId, y.player_id, x.group_no]);
  });
}

/** start next week: a league in every group */
export async function startWeek(clubId: string): Promise<string[]> {
  const view = await getClubView(clubId);
  if (view.running) throw new ClubError(409, `Week ${view.nextWeek - 1} is still being played.`);
  const r = await clubRow(clubId);
  return createClubLeagues({
    clubId,
    hostId: r.host_id,
    clubName: r.name,
    week: view.nextWeek,
    settings: view.leagueSettings,
    groups: view.groups.map((g) => ({ group: g.group, name: g.name, playerIds: g.members.map((m) => m.id) })),
  });
}
