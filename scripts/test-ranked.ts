/* Pure-logic tests for the Ranked leaderboard (no database needed).
   Run:  npm run test:ranked */
import assert from "node:assert/strict";
import { computeRanked, finishesFor, RANKED_POINTS, type BracketMatch } from "../lib/ecosystem/ranked";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};

/** an 8-player bracket where the lower letter always wins: A champion, B runner-up … */
function eight(id: string): BracketMatch[] {
  const m = (round: number, a: string, b: string): BracketMatch => ({
    tournamentId: id, round, aId: a, bId: b, winnerId: a < b ? a : b,
  });
  return [
    m(1, "A", "H"), m(1, "D", "E"), m(1, "B", "G"), m(1, "C", "F"),
    m(2, "A", "D"), m(2, "B", "C"),
    m(3, "A", "B"),
  ];
}

t("finishes by the round you went out in", () => {
  const f = finishesFor({ id: "t1", name: "Cup", championId: "A", completedAt: "2026-10-01" }, eight("t1"));
  assert.equal(f.get("A"), "champion");
  assert.equal(f.get("B"), "runner_up");
  assert.equal(f.get("C"), "semi_final");
  assert.equal(f.get("D"), "semi_final");
  for (const p of ["E", "F", "G", "H"]) assert.equal(f.get(p), "quarter_final");
});

t("a BYE in round 1 still counts the player's real exit", () => {
  const ms: BracketMatch[] = [
    { tournamentId: "t", round: 1, aId: "A", bId: null, winnerId: "A" }, // BYE
    { tournamentId: "t", round: 1, aId: "B", bId: "C", winnerId: "B" },
    { tournamentId: "t", round: 2, aId: "A", bId: "B", winnerId: "B" },
  ];
  const f = finishesFor({ id: "t", name: "x", championId: "B", completedAt: "x" }, ms);
  assert.deepEqual([f.get("B"), f.get("A"), f.get("C")], ["champion", "runner_up", "semi_final"]);
});

t("points add up across tournaments; titles break ties", () => {
  const rows = computeRanked(
    [
      { id: "t1", name: "October Cup", championId: "A", completedAt: "2026-10-01" },
      { id: "t2", name: "November Cup", championId: "B", completedAt: "2026-11-01" },
    ],
    [...eight("t1"), ...eight("t2").map((m) => ({ ...m, winnerId: m.winnerId === "A" && m.round === 3 ? "B" : m.winnerId }))],
  );
  const a = rows.find((r) => r.playerId === "A")!;
  const b = rows.find((r) => r.playerId === "B")!;
  assert.equal(a.points, RANKED_POINTS.champion + RANKED_POINTS.runnerUp);
  assert.equal(b.points, RANKED_POINTS.champion + RANKED_POINTS.runnerUp);
  assert.equal(a.titles, 1);
  assert.equal(b.tournaments, 2);
  assert.equal(rows.length, 8);
  assert.equal(a.results.length, 2);
  // A and B level on points and titles, same best finish → match wins decide (A: 3+2, B: 2+3)
  assert.ok(rows.indexOf(a) < 2 && rows.indexOf(b) < 2);
});

t("no finished hosted tournament → empty board", () => {
  assert.deepEqual(computeRanked([], []), []);
  assert.deepEqual(
    computeRanked([{ id: "t", name: "x", championId: null, completedAt: null }], eight("t")),
    [],
  );
});

console.log(`\n${n} ranked tests passed`);
