/* Pure-logic tests for the Ranked leaderboard (no database needed).
   Run:  npm run test:ranked */
import assert from "node:assert/strict";
import { computeRanked, RANKED_POINTS, type Finish, type FinishedTournament } from "../lib/ecosystem/ranked";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};

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
  const g = (a: string, b: string, winner = a < b ? a : b) => ({ a, b, winner });
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

t("points for where each player finished", () => {
  const rows = computeRanked([eight("t1", "Cup", "2026-10-01")]);
  const pts = Object.fromEntries(rows.map((r) => [r.playerId, r.points]));
  assert.equal(pts.A, RANKED_POINTS.champion);
  assert.equal(pts.B, RANKED_POINTS.runnerUp);
  assert.equal(pts.C, RANKED_POINTS.semiFinal);
  assert.equal(pts.H, RANKED_POINTS.quarterFinal);
  assert.equal(rows[0].playerId, "A");
});

t("points add up across tournaments; wins and losses come from the matches", () => {
  const rows = computeRanked([
    eight("t1", "October Cup", "2026-10-01"),
    eight("t2", "November Cup", "2026-11-01", "B", "A"),
  ]);
  const a = rows.find((r) => r.playerId === "A")!;
  const b = rows.find((r) => r.playerId === "B")!;
  assert.equal(a.points, RANKED_POINTS.champion + RANKED_POINTS.runnerUp);
  assert.equal(b.points, RANKED_POINTS.champion + RANKED_POINTS.runnerUp);
  assert.equal(a.titles, 1);
  assert.equal(b.tournaments, 2);
  assert.equal(rows.length, 8);
  assert.equal(a.results.length, 2);
  assert.equal(a.wins, 5);
  assert.equal(a.losses, 1);
  assert.ok(rows.indexOf(a) < 2 && rows.indexOf(b) < 2);
});

t("no finished official tournament → empty board", () => {
  assert.deepEqual(computeRanked([]), []);
});

console.log(`\n${n} ranked tests passed`);
