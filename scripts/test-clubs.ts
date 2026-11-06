/* Pure-logic tests for club weekly regrouping: npm run test:clubs */
import assert from "node:assert/strict";
import { groupLabel, movesAcross, planMoves } from "../lib/clubs/regroup";

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`✓ ${name}`);
};
const ids = (p: string, k: number) => Array.from({ length: k }, (_, i) => `${p}${i + 1}`);

test("two groups of 8, half: top 4 of each make the new Pro group", () => {
  const pro = ids("p", 8);
  const g2 = ids("g", 8);
  const moves = planMoves(
    [
      { group: 1, members: pro, order: pro },
      { group: 2, members: g2, order: g2 },
    ],
    null,
  );
  const down = moves.filter((m) => m.to === 2).map((m) => m.playerId);
  const up = moves.filter((m) => m.to === 1).map((m) => m.playerId);
  assert.deepEqual(down, ["p5", "p6", "p7", "p8"]);
  assert.deepEqual(up, ["g1", "g2", "g3", "g4"]);
});

test("fixed move count", () => {
  const moves = planMoves(
    [
      { group: 1, members: ids("p", 6), order: ids("p", 6) },
      { group: 2, members: ids("g", 6), order: ids("g", 6) },
    ],
    2,
  );
  assert.deepEqual(moves.map((m) => m.playerId).sort(), ["g1", "g2", "p5", "p6"]);
});

test("never more than half of a group moves across one boundary", () => {
  assert.equal(movesAcross(4, 10, 5), 2);
  assert.equal(movesAcross(10, 10, null), 5);
  assert.equal(movesAcross(3, 9, null), 1);
  assert.equal(movesAcross(5, 5, 0), 0);
});

test("a middle group sends players both ways without overlap", () => {
  const moves = planMoves(
    [
      { group: 1, members: ids("a", 4), order: ids("a", 4) },
      { group: 2, members: ids("b", 4), order: ids("b", 4) },
      { group: 3, members: ids("c", 4), order: ids("c", 4) },
    ],
    null,
  );
  const fromB = moves.filter((m) => m.from === 2);
  assert.deepEqual(fromB.map((m) => [m.playerId, m.to]), [
    ["b1", 1],
    ["b2", 1],
    ["b3", 3],
    ["b4", 3],
  ]);
  assert.equal(new Set(moves.map((m) => m.playerId)).size, moves.length);
});

test("a group that didn't play has no moves; late joiners stay put", () => {
  const moves = planMoves(
    [
      { group: 1, members: [...ids("p", 4), "late"], order: ids("p", 4) },
      { group: 2, members: ids("g", 4), order: null },
    ],
    null,
  );
  assert.equal(moves.length, 0);
  // a middle group that sat out is stepped over: groups 1 and 3 swap with each other
  const skip = planMoves(
    [
      { group: 1, members: ids("a", 4), order: ids("a", 4) },
      { group: 2, members: ["x1", "x2"], order: null },
      { group: 3, members: ids("c", 4), order: ids("c", 4) },
    ],
    null,
  );
  assert.deepEqual(skip.map((m) => [m.playerId, m.from, m.to]), [
    ["a3", 1, 3],
    ["a4", 1, 3],
    ["c1", 3, 1],
    ["c2", 3, 1],
  ]);
  const m2 = planMoves(
    [
      { group: 1, members: [...ids("p", 4), "late"], order: ids("p", 4) },
      { group: 2, members: ids("g", 4), order: ids("g", 4) },
    ],
    null,
  );
  assert.ok(!m2.some((m) => m.playerId === "late"));
});

test("players who left the club are ignored", () => {
  const moves = planMoves(
    [
      { group: 1, members: ["p1", "p2", "p3"], order: ["p1", "p2", "p3", "gone"] },
      { group: 2, members: ["g1", "g2", "g3"], order: ["g1", "g2", "g3"] },
    ],
    null,
  );
  assert.deepEqual(moves.map((m) => m.playerId), ["p3", "g1"]);
});

test("group names", () => {
  assert.equal(groupLabel([], 1), "Pro");
  assert.equal(groupLabel([], 2), "Group 2");
  assert.equal(groupLabel(["Elite", " "], 2), "Group 2");
  assert.equal(groupLabel(["Elite"], 1), "Elite");
});

console.log(`\n${n} club tests passed`);
