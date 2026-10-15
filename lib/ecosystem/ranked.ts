/* ============================================================
   Ranked leaderboard — built ONLY from tournaments Cue Point hosts
   (the house tournaments staff run from the console). It is empty
   until the first one finishes; every finished tournament then
   awards ranking points by how far each player got.

   Pure: callers pass in the finished tournaments and their bracket
   matches. The in-house leaderboard (every registered player, every
   recorded match) lives in store.getLeaderboard and is untouched.
   ============================================================ */

/** points for where you finished in one hosted tournament */
export const RANKED_POINTS = {
  champion: 100,
  runnerUp: 70,
  semiFinal: 45,
  quarterFinal: 25,
  roundOf16: 15,
  /** reached the draw but went out earlier */
  played: 10,
} as const;

export type Finish = "champion" | "runner_up" | "semi_final" | "quarter_final" | "round_of_16" | "played";

export const FINISH_LABEL: Record<Finish, string> = {
  champion: "Champion",
  runner_up: "Runner-up",
  semi_final: "Semi-final",
  quarter_final: "Quarter-final",
  round_of_16: "Last 16",
  played: "Played",
};

const FINISH_POINTS: Record<Finish, number> = {
  champion: RANKED_POINTS.champion,
  runner_up: RANKED_POINTS.runnerUp,
  semi_final: RANKED_POINTS.semiFinal,
  quarter_final: RANKED_POINTS.quarterFinal,
  round_of_16: RANKED_POINTS.roundOf16,
  played: RANKED_POINTS.played,
};
/** lower = better, for "best finish" */
const FINISH_ORDER: Finish[] = ["champion", "runner_up", "semi_final", "quarter_final", "round_of_16", "played"];

export interface HostedTournament {
  id: string;
  name: string;
  championId: string | null;
  completedAt: string | null;
}

export interface BracketMatch {
  tournamentId: string;
  round: number;
  aId: string | null;
  bId: string | null;
  winnerId: string | null;
}

export interface TournamentResult {
  tournamentId: string;
  tournamentName: string;
  finish: Finish;
  points: number;
}

export interface RankedEntry {
  playerId: string;
  points: number;
  tournaments: number;
  titles: number;
  bestFinish: Finish;
  wins: number;
  losses: number;
  results: TournamentResult[];
}

/** how far each entrant got in one single-elimination bracket */
export function finishesFor(t: HostedTournament, matches: BracketMatch[]): Map<string, Finish> {
  const out = new Map<string, Finish>();
  const ms = matches.filter((m) => m.tournamentId === t.id);
  if (!ms.length) return out;
  const rounds = Math.max(...ms.map((m) => m.round));
  for (const m of ms) {
    for (const p of [m.aId, m.bId]) if (p && !out.has(p)) out.set(p, "played");
  }
  // a played match: its loser went out in this round
  for (const m of ms) {
    if (!m.winnerId || !m.aId || !m.bId) continue;
    const loser = m.winnerId === m.aId ? m.bId : m.aId;
    const left = rounds - m.round + 1; // 1 = final, 2 = semis, …
    out.set(
      loser,
      left === 1 ? "runner_up" : left === 2 ? "semi_final" : left === 3 ? "quarter_final" : left === 4 ? "round_of_16" : "played",
    );
  }
  const champ = t.championId ?? ms.find((m) => m.round === rounds)?.winnerId ?? null;
  if (champ) out.set(champ, "champion");
  return out;
}

/** the ranked table across every finished hosted tournament, best first */
export function computeRanked(tournaments: HostedTournament[], matches: BracketMatch[]): RankedEntry[] {
  const byPlayer = new Map<string, RankedEntry>();
  const entry = (id: string) => {
    let e = byPlayer.get(id);
    if (!e) {
      e = { playerId: id, points: 0, tournaments: 0, titles: 0, bestFinish: "played", wins: 0, losses: 0, results: [] };
      byPlayer.set(id, e);
    }
    return e;
  };
  const done = [...tournaments]
    .filter((t) => t.completedAt !== null || t.championId !== null)
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));

  for (const t of done) {
    for (const [pid, finish] of finishesFor(t, matches)) {
      const e = entry(pid);
      const pts = FINISH_POINTS[finish];
      e.points += pts;
      e.tournaments += 1;
      if (finish === "champion") e.titles += 1;
      if (FINISH_ORDER.indexOf(finish) < FINISH_ORDER.indexOf(e.bestFinish)) e.bestFinish = finish;
      e.results.push({ tournamentId: t.id, tournamentName: t.name, finish, points: pts });
    }
    for (const m of matches.filter((x) => x.tournamentId === t.id && x.winnerId && x.aId && x.bId)) {
      entry(m.winnerId!).wins += 1;
      entry(m.winnerId === m.aId ? m.bId! : m.aId!).losses += 1;
    }
  }
  return [...byPlayer.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.titles - a.titles ||
      FINISH_ORDER.indexOf(a.bestFinish) - FINISH_ORDER.indexOf(b.bestFinish) ||
      b.wins - a.wins,
  );
}
