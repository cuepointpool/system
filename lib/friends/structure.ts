/* ============================================================
   Tournament structures — pure, no I/O. Shared by the server
   (which turns a plan into rows) and the create screen (which
   previews the same plan), so the preview can never disagree
   with what actually gets built.

   Every format is a set of stages made of ordinary matches. A
   match knows where its WINNER goes and, for double elimination
   or a 3rd-place match, where its LOSER goes. That one idea covers:

     knockout      single elimination (+ optional 3rd-place match)
     double_elim   upper + lower bracket, grand final
     league        everyone plays everyone (once or twice), then
                   top of the table wins, or a final / semis / quarters
     groups        round-robin groups, then a knockout between the
                   qualifiers — or each group crowns its own winner

   Entrants are opaque (team ids on the server, numbers in a preview).
   ============================================================ */

import { generateBracket, roundName } from "./bracket";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export type TournamentKind = "knockout" | "double_elim" | "league" | "groups";
/** how a league ends */
export type LeagueFinish = "table" | "final" | "top4" | "top8";
/** how a group stage ends */
export type GroupFinish = "knockout" | "none";

export interface TournamentSettings {
  kind: TournamentKind;
  /** league / groups: play everyone once or twice */
  legs: 1 | 2;
  /** league only */
  finish: LeagueFinish;
  /** groups only: number of groups and how many go through from each */
  groups: number;
  advance: number;
  groupFinish: GroupFinish;
  /** any knockout stage of 4+: losers of the semis play for 3rd. League
   *  "final" finish: 3rd v 4th play for 3rd. */
  thirdPlace: boolean;
  /** level on points: "decider" = straight to a rematch; "h2h" = head-to-head
   *  result first, rematch only if still level */
  tiebreak: "decider" | "h2h";
  /** "session" = play it all in one go; "weekly" = one matchday per week */
  schedule: "session" | "weekly";
  /** first day of week 1 (weekly only), YYYY-MM-DD */
  startDate: string | null;
  /** match length per round: { [slot key]: 1 | 3 | 5 | 7 | 9 } — see bestOfSlots */
  bestOf: Record<string, BestOf>;
}

export const DEFAULT_SETTINGS: TournamentSettings = {
  kind: "knockout",
  legs: 1,
  finish: "final",
  groups: 2,
  advance: 2,
  groupFinish: "knockout",
  thirdPlace: true,
  tiebreak: "decider",
  schedule: "session",
  startDate: null,
  bestOf: {},
};

export const KIND_LABEL: Record<TournamentKind, string> = {
  knockout: "Knockout",
  double_elim: "Double elimination",
  league: "League",
  groups: "Groups",
};

export const FINISH_LABEL: Record<LeagueFinish, string> = {
  table: "Top of the table wins",
  final: "Final: 1st v 2nd",
  top4: "Semi finals: top 4",
  top8: "Quarter finals: top 8",
};

/** what a format needs, by entrant count */
export const LIMITS = {
  minEntries: 3,
  maxEntries: 32,
  maxLeagueEntries: 20,
  maxDoubleLegLeagueEntries: 12,
  minGroupSize: 3,
  maxGroups: 8,
  /** keep a friends' event playable */
  maxMatches: 200,
};

/** turn anything (request body, stored JSON) into complete, sane settings */
export function normalizeSettings(raw: unknown): TournamentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    allowed.includes(v as T) ? (v as T) : d;
  const int = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const d = DEFAULT_SETTINGS;
  // Tournaments run at the players' own pace — one evening or many days,
  // continued whenever they like. No schedule is imposed any more; old
  // weekly settings simply play on without play-by dates.
  const schedule = "session" as const;
  const kind = pick(r.kind, ["knockout", "double_elim", "league", "groups"] as const, d.kind);
  return {
    kind,
    legs: r.legs === 2 || r.legs === "2" ? 2 : 1,
    finish: pick(r.finish, ["table", "final", "top4", "top8"] as const, d.finish),
    groups: int(r.groups, 2, LIMITS.maxGroups, d.groups),
    advance: int(r.advance, 1, 4, d.advance),
    // Groups always end with an overall 1st, 2nd and 3rd: the best go on to
    // a final and a 3rd-place match (the old "each group has its own winner"
    // is no longer offered).
    groupFinish: "knockout",
    thirdPlace: kind === "groups" ? true : r.thirdPlace === undefined ? d.thirdPlace : r.thirdPlace === true,
    tiebreak: pick(r.tiebreak, ["decider", "h2h"] as const, d.tiebreak),
    schedule,
    startDate: null,
    bestOf: normalizeBestOf(r.bestOf),
  };
}

/** null when `n` entrants can play this format, otherwise the reason */
/**
 * Is this format playable with `n` entries? `noLimit` (official tournaments):
 * Cue Point runs them over as many days as it takes, so the size and
 * match-count caps for friends' events don't apply.
 */
export function validateSettings(s: TournamentSettings, n: number, noLimit = false): string | null {
  if (n < LIMITS.minEntries) return `At least ${LIMITS.minEntries} entries are needed.`;
  if (!noLimit && n > LIMITS.maxEntries) return `At most ${LIMITS.maxEntries} entries.`;
  if (s.kind === "league") {
    const max = s.legs === 2 ? LIMITS.maxDoubleLegLeagueEntries : LIMITS.maxLeagueEntries;
    if (!noLimit && n > max)
      return `A league ${s.legs === 2 ? "played twice " : ""}takes at most ${max} entries — try Groups for more.`;
    if (s.finish === "top4" && n < 5) return "Semi finals need at least 5 entries in the league.";
    if (s.finish === "top8" && n < 9) return "Quarter finals need at least 9 entries in the league.";
  }
  if (s.kind === "groups") {
    if (n < s.groups * LIMITS.minGroupSize)
      return `${s.groups} groups need at least ${s.groups * LIMITS.minGroupSize} entries (${LIMITS.minGroupSize} per group).`;
    const smallest = Math.floor(n / s.groups);
    if (s.advance >= smallest)
      return `With ${smallest} in the smallest group, at most ${smallest - 1} can go through from each group.`;
    if (s.groups * s.advance < 4)
      return `At least 4 need to go through (for a final and a 3rd-place match) — let ${Math.ceil(4 / s.groups)} go through from each group.`;
  }
  if (noLimit) return null;
  const total = describe(s, n).totalMatches;
  if (total > LIMITS.maxMatches)
    return `That would be ${total} matches — too many. Use fewer entries, play once, or use groups.`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Plan                                                               */
/* ------------------------------------------------------------------ */

export type Stage =
  | "knockout"
  | "upper"
  | "lower"
  | "grand_final"
  | "third_place"
  | "league"
  | "group"
  | "playoff"
  | "decider";

export interface SlotRef {
  key: string;
  slot: "a" | "b";
}

export interface PlanGame<T> {
  /** stable within one plan, e.g. "U2-0", "L3-1", "GF", "G2-R4-1" */
  key: string;
  stage: Stage;
  /** 1-based group number (groups only) */
  group: number | null;
  /** round within its stage — the matchday for league/group play */
  round: number;
  position: number;
  /** what the UI calls this round: "Semi Finals", "Matchday 3", "Lower round 2" */
  label: string;
  a: T | null;
  b: T | null;
  /** a first-round knockout game with one entrant, who goes through unplayed */
  isBye: boolean;
  winnerTo: SlotRef | null;
  loserTo: SlotRef | null;
  /** weekly schedule: play by this date (YYYY-MM-DD) */
  dueDate: string | null;
}

const groupLetter = (g: number) => String.fromCharCode(64 + g);
export const groupName = (g: number) => `Group ${groupLetter(g)}`;

/** single elimination, optionally with a 3rd-place match between the semi losers */
export function planKnockout<T>(
  seeded: T[],
  opts: { stage?: "knockout" | "playoff"; thirdPlace?: boolean; prefix?: string } = {},
): PlanGame<T>[] {
  const stage = opts.stage ?? "knockout";
  const prefix = opts.prefix ?? "K";
  if (seeded.length === 2) {
    return [game(`${prefix}1-0`, stage, null, 1, 0, "Final", seeded[0], seeded[1])];
  }
  const b = generateBracket(seeded);
  const games: PlanGame<T>[] = b.games.map((g) => ({
    ...game(`${prefix}${g.round}-${g.position}`, stage, null, g.round, g.position, roundName(g.round, b.rounds), g.a, g.b),
    isBye: g.isBye,
    winnerTo: g.next ? { key: `${prefix}${g.next.round}-${g.next.position}`, slot: g.next.slot } : null,
  }));
  if (opts.thirdPlace && b.rounds >= 2) {
    const third = game<T>(`${prefix}3P`, "third_place", null, b.rounds, 1, "3rd place", null, null);
    for (const g of games.filter((x) => x.round === b.rounds - 1))
      g.loserTo = { key: third.key, slot: g.position === 0 ? "a" : "b" };
    games.push(third);
  }
  return simplify(games);
}

/** upper bracket, lower bracket fed by upper losers, and a grand final */
export function planDoubleElim<T>(seeded: T[]): PlanGame<T>[] {
  const b = generateBracket(seeded);
  const k = b.rounds;
  const games: PlanGame<T>[] = [];
  const U = (r: number, p: number) => `U${r}-${p}`;
  const L = (r: number, p: number) => `L${r}-${p}`;

  for (const g of b.games) {
    games.push({
      ...game(U(g.round, g.position), "upper", null, g.round, g.position, upperName(g.round, k), g.a, g.b),
      isBye: g.isBye,
      winnerTo: g.next ? { key: U(g.next.round, g.next.position), slot: g.next.slot } : { key: "GF", slot: "a" },
    });
  }
  const byKey = new Map(games.map((g) => [g.key, g]));
  const lowerRounds = 2 * (k - 1);
  // lower round r has size/2^(ceil(r/2)+1) games
  const lowerCount = (r: number) => b.size / 2 ** (Math.ceil(r / 2) + 1);

  for (let r = 1; r <= lowerRounds; r++) {
    for (let p = 0; p < lowerCount(r); p++) {
      const last = r === lowerRounds;
      let winnerTo: SlotRef;
      if (last) winnerTo = { key: "GF", slot: "b" };
      else if (r % 2 === 1) winnerTo = { key: L(r + 1, p), slot: "a" }; // meets a dropped upper loser
      else winnerTo = { key: L(r + 1, Math.floor(p / 2)), slot: p % 2 === 0 ? "a" : "b" };
      games.push(game<T>(L(r, p), "lower", null, r, p, "", null, null, winnerTo));
    }
  }
  // drop upper losers into the lower bracket
  for (const g of b.games) {
    const u = byKey.get(U(g.round, g.position))!;
    if (g.round === 1) {
      u.loserTo = { key: L(1, Math.floor(g.position / 2)), slot: g.position % 2 === 0 ? "a" : "b" };
    } else {
      // upper round j losers meet lower round 2(j-1) winners; reversed order to avoid instant rematches
      const r = 2 * (g.round - 1);
      const n = lowerCount(r);
      u.loserTo = { key: L(r, n - 1 - g.position), slot: "b" };
    }
  }
  games.push(game<T>("GF", "grand_final", null, 1, 0, "Grand final", null, null));

  const out = simplify(games);
  // name the lower rounds that survived, in order
  const lower = [...new Set(out.filter((g) => g.stage === "lower").map((g) => g.round))].sort((a, b) => a - b);
  for (const g of out)
    if (g.stage === "lower") {
      const i = lower.indexOf(g.round);
      g.label = i === lower.length - 1 ? "Lower final" : `Lower round ${i + 1}`;
    }
  return out;
}

function upperName(round: number, rounds: number) {
  const n = roundName(round, rounds);
  return n === "Final" ? "Upper final" : `Upper ${n.toLowerCase()}`;
}

/** circle-method round robin; an odd count gives one entrant a rest each round */
export function roundRobinRounds<T>(entrants: T[]): [T, T][][] {
  const list: (T | null)[] = [...entrants];
  if (list.length % 2) list.push(null);
  const m = list.length;
  const rounds: [T, T][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: [T, T][] = [];
    for (let i = 0; i < m / 2; i++) {
      const x = list[i];
      const y = list[m - 1 - i];
      if (x === null || y === null) continue;
      // alternate who is listed first so nobody is always "side A"
      pairs.push(r % 2 === 0 ? [x, y] : [y, x]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** everyone in `entrants` plays everyone, once or twice */
export function planRoundRobin<T>(
  entrants: T[],
  opts: { legs: 1 | 2; group?: number | null; startDate?: string | null },
): PlanGame<T>[] {
  const group = opts.group ?? null;
  const stage: Stage = group ? "group" : "league";
  const once = roundRobinRounds(entrants);
  const all = opts.legs === 2 ? [...once, ...once.map((r) => r.map(([x, y]) => [y, x] as [T, T]))] : once;
  const games: PlanGame<T>[] = [];
  all.forEach((pairs, i) => {
    const round = i + 1;
    const due = opts.startDate ? addDays(opts.startDate, 7 * round - 1) : null;
    const label = opts.startDate ? `Week ${round}` : `Matchday ${round}`;
    pairs.forEach(([x, y], position) => {
      const g = game(`${group ? `G${group}-` : ""}R${round}-${position}`, stage, group, round, position, label, x, y);
      g.dueDate = due;
      games.push(g);
    });
  });
  return games;
}

/** snake seeding: 1→A, 2→B, …, then back the other way, so groups are even */
export function splitIntoGroups<T>(seeded: T[], groups: number): T[][] {
  const out: T[][] = Array.from({ length: groups }, () => []);
  seeded.forEach((x, i) => {
    const lap = Math.floor(i / groups);
    const g = lap % 2 === 0 ? i % groups : groups - 1 - (i % groups);
    out[g].push(x);
  });
  return out;
}

/** the games created when the tournament starts */
export function planMain<T>(s: TournamentSettings, seeded: T[]): PlanGame<T>[] {
  switch (s.kind) {
    case "knockout":
      return planKnockout(seeded, { thirdPlace: s.thirdPlace });
    case "double_elim":
      return planDoubleElim(seeded);
    case "league":
      return planRoundRobin(seeded, { legs: s.legs, startDate: s.startDate });
    case "groups":
      return splitIntoGroups(seeded, s.groups).flatMap((g, i) =>
        planRoundRobin(g, { legs: s.legs, group: i + 1, startDate: s.startDate }),
      );
  }
}

/** does this format have a second stage after the table / groups? */
export function hasPlayoffs(s: TournamentSettings): boolean {
  if (s.kind === "league") return s.finish !== "table";
  if (s.kind === "groups") return s.groupFinish === "knockout";
  return false;
}

/**
 * Playoff games once the table is final. `tables` are the final standings,
 * best first — one list for a league, one per group for groups.
 */
export function planPlayoffs<T>(s: TournamentSettings, tables: T[][]): PlanGame<T>[] {
  if (s.kind === "league") {
    const t = tables[0];
    if (s.finish === "final") {
      const games = planKnockout([t[0], t[1]], { stage: "playoff", prefix: "P" });
      if (s.thirdPlace && t.length >= 4)
        games.push(game("P3P", "third_place", null, 1, 1, "3rd place", t[2], t[3]));
      return games;
    }
    const top = s.finish === "top4" ? 4 : 8;
    return planKnockout(t.slice(0, top), { stage: "playoff", prefix: "P", thirdPlace: s.thirdPlace });
  }
  // groups: all group winners first (A1, B1, …), then runners-up, …
  const qualifiers: T[] = [];
  for (let place = 0; place < s.advance; place++) for (const t of tables) if (t[place] !== undefined) qualifiers.push(t[place]);
  return planKnockout(qualifiers, { stage: "playoff", prefix: "P", thirdPlace: s.thirdPlace });
}

/**
 * Where a line is drawn in a table, as "after this many places". A tie that
 * straddles one of these lines has to be broken; ties elsewhere don't matter.
 */
export function cutsFor(s: TournamentSettings, tableSize: number): number[] {
  let cuts: number[];
  if (s.kind === "league") {
    cuts =
      s.finish === "table" ? [1, 2, 3]
      : s.finish === "final" ? (s.thirdPlace ? [2, 4] : [2])
      : s.finish === "top4" ? [4]
      : [8];
  } else if (s.kind === "groups") {
    cuts = s.groupFinish === "knockout" ? [s.advance] : [1];
  } else cuts = [];
  return cuts.filter((c) => c < tableSize);
}

/* ------------------------------------------------------------------ */
/*  Match length — best of 1 / 3 / 5 / 7 / 9, chosen per round        */
/* ------------------------------------------------------------------ */

export const BEST_OF_OPTIONS = [1, 3, 5, 7, 9] as const;
export type BestOf = (typeof BEST_OF_OPTIONS)[number];

export const bestOfLabel = (n: number) => (n === 1 ? "Single frame" : `Best of ${n}`);
/** frames needed to win: best of 5 → first to 3 */
export const framesToWin = (n: number) => Math.ceil(n / 2);

function normalizeBestOf(raw: unknown): Record<string, BestOf> {
  const out: Record<string, BestOf> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (k.length <= 40 && (BEST_OF_OPTIONS as readonly number[]).includes(n)) out[k] = n as BestOf;
  }
  return out;
}

/** the key a match's length is chosen by: all table matches share one */
export function bestOfSlot(g: { stage: Stage; label: string }): string {
  if (g.stage === "league" || g.stage === "group") return TABLE_SLOT;
  if (g.stage === "decider") return TIE_SLOT;
  return g.label;
}
export const TABLE_SLOT = "Table matches";
export const TIE_SLOT = "Tie-breakers";

export function bestOfFor(s: TournamentSettings, g: { stage: Stage; label: string }): BestOf {
  const slot = bestOfSlot(g);
  // tie-breakers default to the table's length until the organizer picks one
  return s.bestOf[slot] ?? (slot === TIE_SLOT ? s.bestOf[TABLE_SLOT] : undefined) ?? 1;
}

/**
 * The rounds an organizer can set a match length for, in playing order —
 * e.g. ["Table matches", "Semi Finals", "Final", "3rd place"]. Worked out
 * from the same plan the tournament will be built from.
 */
export function bestOfSlots(s: TournamentSettings, n: number): string[] {
  if (n < 2) return [];
  const ids = Array.from({ length: n }, (_, i) => i);
  const plan = planMain(s, ids);
  let all = plan;
  if (s.kind === "league" && s.finish !== "table") all = [...plan, ...planPlayoffs(s, [ids])];
  if (s.kind === "groups" && s.groupFinish === "knockout")
    all = [...plan, ...planPlayoffs(s, splitIntoGroups(ids, s.groups))];
  const order: string[] = [];
  for (const g of all) {
    if (g.isBye) continue;
    const key = bestOfSlot(g);
    if (!order.includes(key)) order.push(key);
    // level on points at a cut → play-off matches, right after the table
    if (key === TABLE_SLOT && !order.includes(TIE_SLOT) && cutsFor(s, n).length) order.push(TIE_SLOT);
  }
  // the 3rd-place match is played alongside the final; list it last
  return [...order.filter((k) => k !== "3rd place"), ...order.filter((k) => k === "3rd place")];
}

/**
 * null when (a, b) is a finished scoreline for this match length, otherwise
 * the reason. Best of 5: the winner has exactly 3, the loser 0–2.
 */
export function checkScore(bestOf: number, a: number, b: number): string | null {
  const need = framesToWin(bestOf);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Enter the frames each side won.";
  const [hi, lo] = a > b ? [a, b] : [b, a];
  if (hi !== need || lo >= need)
    return bestOf === 1
      ? "A single-frame match ends 1–0."
      : `${bestOfLabel(bestOf)} ends when someone reaches ${need} — e.g. ${need}–${need - 1}.`;
  return null;
}

/** every valid finished score with `side` winning, e.g. best of 5 → [3-0, 3-1, 3-2] */
export function winningScores(bestOf: number): [number, number][] {
  const need = framesToWin(bestOf);
  return Array.from({ length: need }, (_, lose) => [need, lose] as [number, number]);
}

/* ------------------------------------------------------------------ */
/*  Standings                                                          */
/* ------------------------------------------------------------------ */

export interface ResultLite {
  a: string | null;
  b: string | null;
  winner: string | null;
  /** frames won by each side (best-of matches); absent = a single frame */
  scoreA?: number | null;
  scoreB?: number | null;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  /** frames won and lost across their matches */
  framesFor: number;
  framesAgainst: number;
  /** 1-based; tied entries share a number */
  position: number;
  /** level with a neighbour and nothing has separated them yet */
  tied: boolean;
}

export const POINTS_PER_WIN = 3;

/**
 * Order a table. Points first; then (if chosen) the head-to-head mini-table
 * among the level entries; then any recorded tie-break order (a decider
 * result, or the organizer's ruling). Whatever is still level stays tied.
 * `teamIds` are in seed order, which is also the display order among ties.
 */
export function computeStandings(
  teamIds: string[],
  results: ResultLite[],
  opts: {
    tiebreak: "decider" | "h2h";
    /** recorded orders from older tournaments (no longer created) */
    orders: string[][];
    /** finished play-off matches between level players */
    deciders?: ResultLite[];
  },
): StandingRow[] {
  const row = new Map<string, StandingRow>(
    teamIds.map((id) => [id, { teamId: id, played: 0, won: 0, lost: 0, points: 0, framesFor: 0, framesAgainst: 0, position: 0, tied: false }]),
  );
  for (const r of results) {
    if (!r.winner || !r.a || !r.b) continue;
    const loser = r.winner === r.a ? r.b : r.a;
    const w = row.get(r.winner);
    const l = row.get(loser);
    if (!w || !l) continue;
    w.played++;
    w.won++;
    w.points += POINTS_PER_WIN;
    l.played++;
    l.lost++;
    const fa = r.scoreA ?? (r.winner === r.a ? 1 : 0);
    const fb = r.scoreB ?? (r.winner === r.b ? 1 : 0);
    const [wf, lf] = r.winner === r.a ? [fa, fb] : [fb, fa];
    w.framesFor += wf;
    w.framesAgainst += lf;
    l.framesFor += lf;
    l.framesAgainst += wf;
  }
  const seedIndex = new Map(teamIds.map((id, i) => [id, i]));
  const bySeed = (x: string, y: string) => seedIndex.get(x)! - seedIndex.get(y)!;

  // split ids into ordered blocks of entries that are still level
  const blocks: string[][] = [];
  const byPoints = [...teamIds].sort((x, y) => row.get(y)!.points - row.get(x)!.points || bySeed(x, y));
  for (const id of byPoints) {
    const last = blocks[blocks.length - 1];
    if (last && row.get(last[0])!.points === row.get(id)!.points) last.push(id);
    else blocks.push([id]);
  }

  const resolve = (block: string[], allowH2h: boolean): string[][] => {
    if (block.length < 2) return [block];
    if (allowH2h) {
      const set = new Set(block);
      const mini = new Map(block.map((id) => [id, 0]));
      for (const r of results)
        if (r.winner && r.a && r.b && set.has(r.a) && set.has(r.b)) mini.set(r.winner, mini.get(r.winner)! + 1);
      const values = new Set(mini.values());
      if (values.size > 1) {
        const sub: string[][] = [];
        for (const id of [...block].sort((x, y) => mini.get(y)! - mini.get(x)! || bySeed(x, y))) {
          const last = sub[sub.length - 1];
          if (last && mini.get(last[0]) === mini.get(id)) last.push(id);
          else sub.push([id]);
        }
        return sub.flatMap((b) => resolve(b, true));
      }
    }
    // play-off matches among exactly these level players: most play-off wins
    // goes higher. Everyone level again (A beat B, B beat C, C beat A) → still
    // tied, and another play-off round gets played.
    const inBlock = new Set(block);
    const po = (opts.deciders ?? []).filter(
      (r) => r.winner && r.a && r.b && inBlock.has(r.a) && inBlock.has(r.b),
    );
    if (po.length) {
      const wins = new Map(block.map((id) => [id, 0]));
      for (const r of po) wins.set(r.winner!, wins.get(r.winner!)! + 1);
      if (new Set(wins.values()).size > 1) {
        const sub: string[][] = [];
        for (const id of [...block].sort((x, y) => wins.get(y)! - wins.get(x)! || bySeed(x, y))) {
          const last = sub[sub.length - 1];
          if (last && wins.get(last[0]) === wins.get(id)) last.push(id);
          else sub.push([id]);
        }
        return sub.flatMap((b) => resolve(b, false));
      }
    }
    // a recorded order covering the whole block settles it (older tournaments)
    const order = [...opts.orders].reverse().find((o) => block.every((id) => o.includes(id)));
    if (order) return [...block].sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((id) => [id]);
    return [block];
  };

  const out: StandingRow[] = [];
  for (const block of blocks)
    for (const sub of resolve(block, opts.tiebreak === "h2h")) {
      const position = out.length + 1;
      for (const id of sub) out.push({ ...row.get(id)!, position, tied: sub.length > 1 });
    }
  return out;
}

export interface BlockingTie {
  group: number | null;
  teamIds: string[];
  /** "after this many places" — the line the tie sits across */
  cut: number;
}

/** tied blocks that sit across a line that matters */
export function blockingTies(rows: StandingRow[], cuts: number[], group: number | null): BlockingTie[] {
  const out: BlockingTie[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1].position === rows[i].position) j++;
    if (j > i) {
      const cut = cuts.find((c) => i < c && j >= c);
      if (cut !== undefined) out.push({ group, teamIds: rows.slice(i, j + 1).map((r) => r.teamId), cut });
    }
    i = j + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Preview summary                                                    */
/* ------------------------------------------------------------------ */

export interface StructureSummary {
  stages: { title: string; detail: string; matches: number }[];
  totalMatches: number;
  /** "Everyone plays 7 matches" / "At least 2 matches each" */
  perEntry: string;
}

export function describe(s: TournamentSettings, n: number): StructureSummary {
  const ids = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  if (n < 2) return { stages: [], totalMatches: 0, perEntry: "" };
  const real = (gs: PlanGame<number>[]) => gs.filter((g) => !g.isBye).length;
  const stages: StructureSummary["stages"] = [];
  let perEntry = "";

  if (s.kind === "knockout") {
    const gs = planKnockout(ids, { thirdPlace: s.thirdPlace });
    const rounds = [...new Set(gs.filter((g) => g.stage === "knockout").map((g) => g.label))];
    const byes = gs.filter((g) => g.isBye).length;
    stages.push({ title: "Knockout", detail: rounds.join(" → ") + (byes ? ` · ${byes} BYE${byes > 1 ? "s" : ""}` : ""), matches: real(gs.filter((g) => g.stage === "knockout")) });
    if (gs.some((g) => g.stage === "third_place")) stages.push({ title: "3rd place", detail: "Semi-final losers", matches: 1 });
    perEntry = "Lose once and you're out";
  } else if (s.kind === "double_elim") {
    const gs = planDoubleElim(ids);
    stages.push({ title: "Upper bracket", detail: "Everyone starts here", matches: real(gs.filter((g) => g.stage === "upper")) });
    stages.push({ title: "Lower bracket", detail: "One loss drops you here", matches: real(gs.filter((g) => g.stage === "lower")) });
    stages.push({ title: "Grand final", detail: "Upper winner v lower winner", matches: 1 });
    perEntry = "You're out after two losses";
  } else if (s.kind === "league") {
    const gs = planRoundRobin(ids, { legs: s.legs, startDate: s.startDate });
    const days = Math.max(...gs.map((g) => g.round));
    stages.push({
      title: s.legs === 2 ? "League (home & away)" : "League",
      detail: `${days} ${s.schedule === "weekly" ? "weeks" : "matchdays"}`,
      matches: gs.length,
    });
    perEntry = `Everyone plays ${(n - 1) * s.legs} matches`;
    if (s.finish !== "table") {
      const fake = planPlayoffs(s, [ids]);
      stages.push({ title: FINISH_LABEL[s.finish], detail: playoffDetail(s, fake), matches: real(fake) });
    } else stages.push({ title: "Champion", detail: "Whoever tops the table", matches: 0 });
  } else {
    const groups = splitIntoGroups(ids, s.groups);
    const gs = groups.flatMap((g, i) => planRoundRobin(g, { legs: s.legs, group: i + 1 }));
    const sizes = groups.map((g) => g.length);
    const same = sizes.every((x) => x === sizes[0]);
    stages.push({
      title: `${s.groups} groups`,
      detail: same ? `${sizes[0]} in each` : `${Math.min(...sizes)}–${Math.max(...sizes)} in each`,
      matches: gs.length,
    });
    const least = (Math.min(...sizes) - 1) * s.legs;
    perEntry = `Everyone plays at least ${least} matches`;
    if (s.groupFinish === "knockout") {
      const fake = planPlayoffs(s, groups);
      stages.push({
        title: "Knockout",
        detail: `Top ${s.advance} of each group (${s.groups * s.advance}) · ${playoffDetail(s, fake)}`,
        matches: real(fake),
      });
    } else stages.push({ title: "Group winners", detail: "Each group crowns its own winner", matches: 0 });
  }
  return { stages, totalMatches: stages.reduce((t, x) => t + x.matches, 0), perEntry };
}

function playoffDetail(s: TournamentSettings, gs: PlanGame<number>[]): string {
  const names = [...new Set(gs.filter((g) => g.stage === "playoff").map((g) => g.label))];
  return names.join(" → ") + (gs.some((g) => g.stage === "third_place") ? " + 3rd place" : "");
}

/* ------------------------------------------------------------------ */
/*  internals                                                          */
/* ------------------------------------------------------------------ */

function game<T>(
  key: string,
  stage: Stage,
  group: number | null,
  round: number,
  position: number,
  label: string,
  a: T | null,
  b: T | null,
  winnerTo: SlotRef | null = null,
): PlanGame<T> {
  return { key, stage, group, round, position, label, a, b, isBye: false, winnerTo, loserTo: null, dueDate: null };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Remove matches that can never be played because a BYE leaves one side
 * permanently empty (e.g. a lower-bracket slot waiting for the "loser" of a
 * BYE). The lone entrant is routed straight to where that match would have
 * sent its winner. First-round knockout BYEs are kept so the bracket shows
 * them, exactly as before.
 */
function simplify<T>(games: PlanGame<T>[]): PlanGame<T>[] {
  const byKey = new Map(games.map((g) => [g.key, g]));
  const feeder = new Map<string, { from: string; kind: "winner" | "loser" }>();
  for (const g of games) {
    if (g.winnerTo) feeder.set(`${g.winnerTo.key}:${g.winnerTo.slot}`, { from: g.key, kind: "winner" });
    if (g.loserTo) feeder.set(`${g.loserTo.key}:${g.loserTo.slot}`, { from: g.key, kind: "loser" });
  }
  const memo = new Map<string, boolean>();
  const fills = (key: string, slot: "a" | "b"): boolean => {
    const id = `${key}:${slot}`;
    if (memo.has(id)) return memo.get(id)!;
    const g = byKey.get(key)!;
    let v: boolean;
    if ((slot === "a" ? g.a : g.b) !== null) v = true;
    else {
      const f = feeder.get(id);
      v = !f ? false : f.kind === "winner" ? hasWinner(f.from) : hasLoser(f.from);
    }
    memo.set(id, v);
    return v;
  };
  const hasWinner = (key: string) => fills(key, "a") || fills(key, "b");
  const hasLoser = (key: string) => fills(key, "a") && fills(key, "b");

  const real = (g: PlanGame<T>) => fills(g.key, "a") && fills(g.key, "b");
  const visibleBye = (g: PlanGame<T>) =>
    g.isBye && (g.a !== null) !== (g.b !== null);
  const kept = new Set(games.filter((g) => real(g) || visibleBye(g)).map((g) => g.key));

  // follow a pointer through matches that were removed as pass-throughs
  const resolve = (ref: SlotRef | null): SlotRef | null => {
    let r = ref;
    const seen = new Set<string>();
    while (r && !kept.has(r.key)) {
      if (seen.has(r.key)) return null;
      seen.add(r.key);
      r = byKey.get(r.key)!.winnerTo;
    }
    return r;
  };

  const out: PlanGame<T>[] = [];
  for (const g of games) {
    if (!kept.has(g.key)) continue;
    out.push({
      ...g,
      winnerTo: resolve(g.winnerTo),
      loserTo: g.isBye ? null : resolve(g.loserTo),
    });
  }
  return out;
}

/** one line describing how a tournament is played */
export function formatLine(s: TournamentSettings): string {
  const parts: string[] = [s.kind === "double_elim" ? "Two lives" : KIND_LABEL[s.kind]];
  if (s.kind === "league") parts.push(FINISH_LABEL[s.finish]);
  if (s.kind === "groups") parts.push(`${s.groups} groups`, `top ${s.advance} of each to the final rounds`);
  if ((s.kind === "league" || s.kind === "groups") && s.legs === 2) parts.push("play each other twice");
  if (s.thirdPlace && (s.kind === "knockout" || (s.kind === "league" && s.finish !== "table") || (s.kind === "groups" && s.groupFinish === "knockout")))
    parts.push("3rd-place match");
  const lengths = Object.entries(s.bestOf).filter(([, n]) => n > 1);
  if (lengths.length) parts.push(lengths.map(([round, n]) => `${round} best of ${n}`).join(", "));
  return parts.join(" · ");
}
