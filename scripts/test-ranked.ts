/* Pure-logic tests for the Ranked leaderboard (no database needed).
   Run:  npm run test:ranked */
import assert from "node:assert/strict";
import {
  computeRanked,
  MATCH_POINTS,
  RANKED_POINTS,
  type Finish,
  type FinishedTournament,
} from "../lib/ecosystem/ranked";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};

const KO_WIN = MATCH_POINTS.knockout.win + MATCH_POINTS.knockout.played;
const KO_LOSS = MATCH_POINTS.knockout.played;
const TB_WIN = MATCH_POINTS.table.win + MATCH_POINTS.table.played;
const TB_LOSS = MATCH_POINTS.table.played;

/** an 8-player knockout where the lower letter always wins: A champion, B runner-up … */
function eight(id: string, name: string, completedAt: string, champ = "A", runner = "B"): FinishedTournament {
  const finishes = new Map<string, Finish>([
    [champ, "champion"],
    [runner, "runner_up"],
    ["C", "semi_final"],
    ["D", "semi_final"],
    ["E", "quarter_final"],
    ["F", "quarter_final"],
    ["G", "quarter_final"],
    ["H", "quarter_final"],
  ]);
  const g = (a: string, b: string, winner = a < b ? a : b) => ({ a, b, winner, table: false });
  return {
    id,
    name,
    completedAt,
    finishes,
    games: [
      g("A", "H"), g("D", "E"), g("B", "G"), g("C", "F"),
      g("A", "D"), g("B", "C"),
      g("A", "B", champ),
    ],
  };
}

t("every match earns points, plus a bonus for the finish", () => {
  const rows = computeRanked([eight("t1", "Cup", "2026-10-01")]);
  const pts = Object.fromEntries(rows.map((r) => [r.playerId, r.points]));
  assert.equal(pts.A, 3 * KO_WIN + RANKED_POINTS.champion);
  assert.equal(pts.B, 2 * KO_WIN + KO_LOSS + RANKED_POINTS.runnerUp);
  assert.equal(pts.C, KO_WIN + KO_LOSS + RANKED_POINTS.semiFinal);
  assert.equal(pts.H, KO_LOSS + RANKED_POINTS.quarterFinal);
  const a = rows.find((r) => r.playerId === "A")!;
  assert.equal(a.results[0].matchPoints, 3 * KO_WIN);
  assert.equal(a.results[0].finishPoints, RANKED_POINTS.champion);
  assert.equal(rows[0].playerId, "A");
});

t("league matches are worth less than knockout matches", () => {
  const league: FinishedTournament = {
    id: "L",
    name: "League",
    completedAt: "2026-10-02",
    finishes: new Map<string, Finish>([["X", "champion"], ["Y", "runner_up"]]),
    games: [
      { a: "X", b: "Y", winner: "X", table: true },
      { a: "X", b: "Y", winner: "X", table: false },
    ],
  };
  const [x, y] = computeRanked([league]);
  assert.equal(x.points, TB_WIN + KO_WIN + RANKED_POINTS.champion);
  assert.equal(y.points, TB_LOSS + KO_LOSS + RANKED_POINTS.runnerUp);
});

t("a steady finalist overtakes a one-time champion", () => {
  // cup 1: A wins it, B runner-up. cup 2: A goes out in the quarter finals, B runner-up again
  const g = (a: string, b: string, winner: string) => ({ a, b, winner, table: false });
  const cup2: FinishedTournament = {
    id: "t2",
    name: "Cup 2",
    completedAt: "2026-11-01",
    finishes: new Map<string, Finish>([
      ["C", "champion"], ["B", "runner_up"], ["D", "semi_final"], ["F", "semi_final"],
      ["A", "quarter_final"], ["E", "quarter_final"], ["G", "quarter_final"], ["H", "quarter_final"],
    ]),
    games: [
      g("C", "A", "C"), g("B", "G", "B"), g("D", "E", "D"), g("F", "H", "F"),
      g("C", "D", "C"), g("B", "F", "B"),
      g("C", "B", "C"),
    ],
  };
  const rows = computeRanked([eight("t1", "Cup 1", "2026-10-01"), cup2]);
  const a = rows.find((r) => r.playerId === "A")!;
  const b = rows.find((r) => r.playerId === "B")!;
  assert.ok(b.points > a.points, `B ${b.points} should beat A ${a.points}`);
  assert.equal(a.titles, 1);
  assert.equal(b.titles, 0);
});

t("points add up across tournaments; wins and losses come from the matches", () => {
  const rows = computeRanked([
    eight("t1", "October Cup", "2026-10-01"),
    eight("t2", "November Cup", "2026-11-01", "B", "A"),
  ]);
  const a = rows.find((r) => r.playerId === "A")!;
  assert.equal(a.tournaments, 2);
  assert.equal(a.results.length, 2);
  assert.equal(a.wins, 5);
  assert.equal(a.losses, 1);
  assert.equal(rows.length, 8);
});

t("no finished official tournament → empty board", () => {
  assert.deepEqual(computeRanked([]), []);
});

console.log(`\n${n} ranked tests passed`);
