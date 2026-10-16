/* ============================================================
   Ranked leaderboard — built ONLY from tournaments Cue Point hosts
   (official tournaments, run on the same engine as friend
   tournaments). It is empty until the first one finishes; every
   finished tournament then awards ranking points by how far each
   player got.

   Pure: callers pass in each finished tournament's finishes and
   matches (friends/store officialResults). The in-house leaderboard (every registered player, every
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
  quarter_final: "Last 8",
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

/** one finished official tournament: where everyone finished, and its matches */
export interface FinishedTournament {
  id: string;
  name: string;
  completedAt: string;
  /** player id → finish */
  finishes: Map<string, Finish>;
  games: { a: string; b: string; winner: string }[];
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

/** the ranked table across every finished official tournament, best first */
export function computeRanked(tournaments: FinishedTournament[]): RankedEntry[] {
  const byPlayer = new Map<string, RankedEntry>();
  const entry = (id: string) => {
    let e = byPlayer.get(id);
    if (!e) {
      e = { playerId: id, points: 0, tournaments: 0, titles: 0, bestFinish: "played", wins: 0, losses: 0, results: [] };
      byPlayer.set(id, e);
    }
    return e;
  };
  const done = [...tournaments].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  for (const t of done) {
    for (const [pid, finish] of t.finishes) {
      const e = entry(pid);
      const pts = FINISH_POINTS[finish];
      e.points += pts;
      e.tournaments += 1;
      if (finish === "champion") e.titles += 1;
      if (FINISH_ORDER.indexOf(finish) < FINISH_ORDER.indexOf(e.bestFinish)) e.bestFinish = finish;
      e.results.push({ tournamentId: t.id, tournamentName: t.name, finish, points: pts });
    }
    for (const g of t.games) {
      entry(g.winner).wins += 1;
      entry(g.winner === g.a ? g.b : g.a).losses += 1;
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
