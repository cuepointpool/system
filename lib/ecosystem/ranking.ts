/* ============================================================
   Cue Point ranking engine — isolated & configurable.

   Elo-style: winning against a stronger opponent earns more,
   losing to a much stronger opponent costs less, and match
   context (casual / ranked / tournament) scales the swing.

   Everything derives from the ordered match log so cached
   PlayerStats can always be rebuilt (see store.recomputeRankings).
   ============================================================ */

import type { Match, MatchResult, MatchType } from "./types";

export const RANKING_CONFIG = {
  startPoints: 1200,
  floor: 400,
  /** base K per match context — bigger K = bigger rating swings */
  kBase: {
    casual: 14,
    ranked: 28,
    tournament: 40,
  } as Record<MatchType, number>,
  /** new players move faster until they have this many ranked/tournament results */
  provisionalMatches: 10,
  provisionalMultiplier: 1.6,
  /** scoreline bonus: a 5-0 whitewash swings a little harder than a 5-4 */
  marginInfluence: 0.35,
  /** hard cap on a single match's swing */
  maxSwing: 60,
  eloDivisor: 400,
  formLength: 5,
} as const;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / RANKING_CONFIG.eloDivisor));
}

function kFactor(type: MatchType, priorMatches: number): number {
  let k = RANKING_CONFIG.kBase[type] ?? RANKING_CONFIG.kBase.ranked;
  if (priorMatches < RANKING_CONFIG.provisionalMatches) {
    k *= RANKING_CONFIG.provisionalMultiplier;
  }
  return k;
}

function marginFactor(scoreA: number, scoreB: number): number {
  const total = scoreA + scoreB;
  if (total <= 0) return 1;
  const margin = Math.abs(scoreA - scoreB) / total; // 0..1
  return 1 + margin * RANKING_CONFIG.marginInfluence;
}

export interface MatchDelta {
  aBefore: number;
  bBefore: number;
  aAfter: number;
  bAfter: number;
  aDelta: number;
  bDelta: number;
}

/** Pure function — apply one match to two ratings. */
export function applyMatch(params: {
  ratingA: number;
  ratingB: number;
  scoreA: number;
  scoreB: number;
  winnerIsA: boolean;
  type: MatchType;
  priorMatchesA: number;
  priorMatchesB: number;
}): MatchDelta {
  const {
    ratingA,
    ratingB,
    scoreA,
    scoreB,
    winnerIsA,
    type,
    priorMatchesA,
    priorMatchesB,
  } = params;

  const expA = expectedScore(ratingA, ratingB);
  const expB = 1 - expA;
  const actualA = winnerIsA ? 1 : 0;
  const actualB = winnerIsA ? 0 : 1;
  const margin = marginFactor(scoreA, scoreB);

  const rawA = kFactor(type, priorMatchesA) * (actualA - expA) * margin;
  const rawB = kFactor(type, priorMatchesB) * (actualB - expB) * margin;

  const clamp = (v: number) =>
    Math.max(-RANKING_CONFIG.maxSwing, Math.min(RANKING_CONFIG.maxSwing, v));

  let aDelta = Math.round(clamp(rawA));
  let bDelta = Math.round(clamp(rawB));

  const aAfter = Math.max(RANKING_CONFIG.floor, ratingA + aDelta);
  const bAfter = Math.max(RANKING_CONFIG.floor, ratingB + bDelta);
  aDelta = aAfter - ratingA;
  bDelta = bAfter - ratingB;

  return { aBefore: ratingA, bBefore: ratingB, aAfter, bAfter, aDelta, bDelta };
}

export interface PlayerRatingState {
  points: number;
  played: number; // counts toward provisional (ranked + tournament)
  form: MatchResult[]; // most-recent-first
  streak: number;
  lastMatchAt: string | null;
  history: { points: number; matchId: string; at: string; delta: number }[];
}

export function emptyState(): PlayerRatingState {
  return {
    points: RANKING_CONFIG.startPoints,
    played: 0,
    form: [],
    streak: 0,
    lastMatchAt: null,
    history: [],
  };
}

/**
 * Replay the full match log (chronological) and return the final rating
 * state per player, plus per-match rating snapshots keyed by match id.
 */
export function replayMatches(matches: Match[]): {
  states: Map<string, PlayerRatingState>;
  snapshots: Map<
    string,
    { aBefore: number; aAfter: number; bBefore: number; bAfter: number }
  >;
} {
  const ordered = [...matches].sort(
    (a, b) => +new Date(a.playedAt) - +new Date(b.playedAt),
  );
  const states = new Map<string, PlayerRatingState>();
  const snapshots = new Map<
    string,
    { aBefore: number; aAfter: number; bBefore: number; bAfter: number }
  >();

  const get = (id: string) => {
    let s = states.get(id);
    if (!s) {
      s = emptyState();
      states.set(id, s);
    }
    return s;
  };

  for (const m of ordered) {
    const a = get(m.playerAId);
    const b = get(m.playerBId);
    const winnerIsA = m.winnerId === m.playerAId;

    const d = applyMatch({
      ratingA: a.points,
      ratingB: b.points,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerIsA,
      type: m.type,
      priorMatchesA: a.played,
      priorMatchesB: b.played,
    });

    a.points = d.aAfter;
    b.points = d.bAfter;
    snapshots.set(m.id, d);

    const counts = m.type !== "casual";
    if (counts) {
      a.played += 1;
      b.played += 1;
    }

    pushForm(a, winnerIsA ? "W" : "L");
    pushForm(b, winnerIsA ? "L" : "W");
    a.lastMatchAt = m.playedAt;
    b.lastMatchAt = m.playedAt;
    a.history.push({ points: d.aAfter, matchId: m.id, at: m.playedAt, delta: d.aDelta });
    b.history.push({ points: d.bAfter, matchId: m.id, at: m.playedAt, delta: d.bDelta });
  }

  return { states, snapshots };
}

function pushForm(s: PlayerRatingState, r: MatchResult) {
  s.form.unshift(r);
  if (s.form.length > RANKING_CONFIG.formLength) s.form.pop();
  if (r === "W") s.streak = s.streak >= 0 ? s.streak + 1 : 1;
  else s.streak = s.streak <= 0 ? s.streak - 1 : -1;
}

/** Points gained within a time window (for weekly / monthly scoped boards). */
export function pointsInWindow(
  state: PlayerRatingState,
  sinceISO: string,
): number {
  const since = +new Date(sinceISO);
  return state.history
    .filter((h) => +new Date(h.at) >= since)
    .reduce((sum, h) => sum + h.delta, 0);
}

/** Assign 1-based ranks from a points map (desc), tie-break by id for stability. */
export function assignRanks(points: Map<string, number>): Map<string, number> {
  const sorted = [...points.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const ranks = new Map<string, number>();
  sorted.forEach(([id], i) => ranks.set(id, i + 1));
  return ranks;
}
