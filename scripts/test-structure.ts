/* Pure-logic tests for tournament structures (no database needed).
   Run:  npm run test:structure */
import assert from "node:assert/strict";
import {
  blockingTies,
  computeStandings,
  cutsFor,
  describe,
  normalizeSettings,
  planDoubleElim,
  planKnockout,
  planMain,
  planPlayoffs,
  planRoundRobin,
  roundRobinRounds,
  splitIntoGroups,
  validateSettings,
  bestOfFor,
  bestOfSlots,
  checkScore,
  winningScores,
  type PlanGame,
} from "../lib/friends/structure";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};

/**
 * Play a plan to the end the way the server does: a match is played once both
 * sides are known; the lower number always wins; winners and losers are sent
 * where the plan says. Fails if any match is left waiting forever.
 */
function simulate(games: PlanGame<number>[]) {
  const g = new Map(games.map((x) => [x.key, { ...x }]));
  const done = new Set<string>();
  const results: { key: string; winner: number; loser: number | null }[] = [];
  const put = (ref: { key: string; slot: "a" | "b" } | null, who: number) => {
    if (!ref) return;
    const target = g.get(ref.key);
    assert.ok(target, `points at missing match ${ref.key}`);
    assert.equal(target[ref.slot], null, `${ref.key}.${ref.slot} filled twice`);
    target[ref.slot] = who;
  };
  for (let guard = 0; guard < 1000; guard++) {
    const next = [...g.values()].find(
      (x) => !done.has(x.key) && (x.isBye ? true : x.a !== null && x.b !== null),
    );
    if (!next) break;
    done.add(next.key);
    if (next.isBye) {
      const w = (next.a ?? next.b)!;
      results.push({ key: next.key, winner: w, loser: null });
      put(next.winnerTo, w);
      continue;
    }
    const w = Math.min(next.a!, next.b!);
    const l = Math.max(next.a!, next.b!);
    results.push({ key: next.key, winner: w, loser: l });
    put(next.winnerTo, w);
    put(next.loserTo, l);
  }
  const stuck = [...g.values()].filter((x) => !done.has(x.key)).map((x) => x.key);
  assert.deepEqual(stuck, [], "matches never became playable");
  return { results, played: results.filter((r) => r.loser !== null).length };
}

const ids = (k: number) => Array.from({ length: k }, (_, i) => i);

t("knockout: n−1 matches for every size, champion is seed 1", () => {
  for (let k = 3; k <= 32; k++) {
    const { results, played } = simulate(planKnockout(ids(k)));
    assert.equal(played, k - 1, `size ${k}`);
    assert.equal(results[results.length - 1].winner, 0);
  }
});

t("knockout + 3rd place adds exactly one match (when there are real semis)", () => {
  for (let k = 4; k <= 32; k++) {
    const plan = planKnockout(ids(k), { thirdPlace: true });
    assert.equal(plan.filter((x) => x.stage === "third_place").length, 1, `size ${k}`);
    assert.equal(simulate(plan).played, k, `size ${k}`);
  }
  // 3 entrants: one "semi" is a BYE, so there is no 3rd-place match
  assert.equal(planKnockout(ids(3), { thirdPlace: true }).filter((x) => x.stage === "third_place").length, 0);
});

t("double elimination: 2n−2 matches, nobody stranded, every size 3–32", () => {
  for (let k = 3; k <= 32; k++) {
    const plan = planDoubleElim(ids(k));
    const { played, results } = simulate(plan);
    assert.equal(played, 2 * k - 2, `size ${k}`);
    const gf = results.find((r) => r.key === "GF")!;
    assert.equal(gf.winner, 0);
    // the champion never loses; everyone else is out after exactly two losses
    const losses = new Map<number, number>();
    for (const r of results) if (r.loser !== null) losses.set(r.loser, (losses.get(r.loser) ?? 0) + 1);
    for (const e of ids(k)) {
      const want = e === 0 ? 0 : 2;
      assert.equal(losses.get(e) ?? 0, want, `size ${k} entrant ${e}`);
    }
  }
});

t("double elimination labels: upper/lower/grand final", () => {
  const plan = planDoubleElim(ids(8));
  assert.ok(plan.some((g) => g.label === "Upper final"));
  assert.ok(plan.some((g) => g.label === "Lower final"));
  assert.ok(plan.some((g) => g.label === "Grand final"));
  assert.ok(plan.some((g) => g.label === "Lower round 1"));
});

t("round robin: everyone meets everyone exactly once per leg", () => {
  for (let k = 3; k <= 12; k++) {
    const rounds = roundRobinRounds(ids(k));
    assert.equal(rounds.length, k % 2 ? k : k - 1);
    const seen = new Set<string>();
    for (const r of rounds) {
      const inRound = new Set<number>();
      for (const [x, y] of r) {
        const key = [Math.min(x, y), Math.max(x, y)].join("-");
        assert.ok(!seen.has(key), `size ${k}: ${key} twice`);
        seen.add(key);
        assert.ok(!inRound.has(x) && !inRound.has(y), "someone plays twice in a round");
        inRound.add(x);
        inRound.add(y);
      }
    }
    assert.equal(seen.size, (k * (k - 1)) / 2);
  }
  assert.equal(planRoundRobin(ids(6), { legs: 2 }).length, 30);
});

t("weekly schedule: one week per matchday with play-by dates", () => {
  const plan = planRoundRobin(ids(4), { legs: 1, startDate: "2026-11-02" });
  const wk1 = plan.filter((g) => g.round === 1);
  assert.equal(wk1[0].label, "Week 1");
  assert.equal(wk1[0].dueDate, "2026-11-08");
  assert.equal(plan.find((g) => g.round === 3)!.dueDate, "2026-11-22");
});

t("groups are snake-seeded and balanced", () => {
  assert.deepEqual(splitIntoGroups(ids(8), 2), [[0, 3, 4, 7], [1, 2, 5, 6]]);
  const g = splitIntoGroups(ids(10), 3).map((x) => x.length);
  assert.deepEqual(g.sort(), [3, 3, 4]);
});

t("group playoffs: winners are top seeds and never meet their own runner-up first", () => {
  const s = normalizeSettings({ kind: "groups", groups: 4, advance: 2, thirdPlace: false });
  const tables = [[10, 11, 12], [20, 21, 22], [30, 31, 32], [40, 41, 42]];
  const plan = planPlayoffs(s, tables);
  const first = plan.filter((g) => g.round === 1);
  for (const g of first) assert.notEqual(Math.floor(g.a! / 10), Math.floor(g.b! / 10));
  assert.equal(plan.filter((g) => g.stage === "playoff").length, 7);
});

t("league final: 1st v 2nd plus 3rd v 4th", () => {
  const s = normalizeSettings({ kind: "league", finish: "final", thirdPlace: true });
  const plan = planPlayoffs(s, [[5, 6, 7, 8, 9]]);
  const fin = plan.find((g) => g.stage === "playoff")!;
  const third = plan.find((g) => g.stage === "third_place")!;
  assert.deepEqual([fin.a, fin.b, fin.label], [5, 6, "Final"]);
  assert.deepEqual([third.a, third.b], [7, 8]);
});

t("standings: 3 points a win, ties flagged, decider order resolves", () => {
  const r = [
    { a: "A", b: "B", winner: "A" },
    { a: "B", b: "C", winner: "B" },
    { a: "C", b: "A", winner: "C" },
    { a: "A", b: "D", winner: "A" },
    { a: "B", b: "D", winner: "B" },
    { a: "C", b: "D", winner: "D" },
  ];
  const rows = computeStandings(["A", "B", "C", "D"], r, { tiebreak: "decider", orders: [] });
  assert.deepEqual(rows.map((x) => [x.teamId, x.points, x.position, x.tied]), [
    ["A", 6, 1, true],
    ["B", 6, 1, true],
    ["C", 3, 3, true],
    ["D", 3, 3, true],
  ]);
  const ties = blockingTies(rows, [2], null);
  assert.equal(ties.length, 0, "A/B tie for the final doesn't matter; C/D for 3rd isn't a cut here");
  const ties2 = blockingTies(rows, [1], null);
  assert.deepEqual(ties2, [{ group: null, teamIds: ["A", "B"], cut: 1 }]);
  const fixed = computeStandings(["A", "B", "C", "D"], r, { tiebreak: "decider", orders: [["B", "A"]] });
  assert.deepEqual(fixed.slice(0, 2).map((x) => [x.teamId, x.position]), [["B", 1], ["A", 2]]);
});

t("head-to-head option separates a two-way tie without a decider", () => {
  const r = [
    { a: "A", b: "B", winner: "B" },
    { a: "A", b: "C", winner: "A" },
    { a: "B", b: "C", winner: "C" },
    { a: "A", b: "D", winner: "A" },
    { a: "B", b: "D", winner: "B" },
    { a: "C", b: "D", winner: "D" },
  ];
  const rows = computeStandings(["A", "B", "C", "D"], r, { tiebreak: "h2h", orders: [] });
  // A and B both 6 points; B beat A
  assert.deepEqual(rows.slice(0, 2).map((x) => [x.teamId, x.position, x.tied]), [["B", 1, false], ["A", 2, false]]);
});

t("cuts follow the finish", () => {
  assert.deepEqual(cutsFor(normalizeSettings({ kind: "league", finish: "final" }), 8), [2, 4]);
  assert.deepEqual(cutsFor(normalizeSettings({ kind: "league", finish: "table" }), 8), [1]);
  assert.deepEqual(cutsFor(normalizeSettings({ kind: "groups", advance: 2 }), 4), [2]);
  assert.deepEqual(cutsFor(normalizeSettings({ kind: "knockout" }), 8), []);
});

t("validation explains what doesn't fit", () => {
  assert.equal(validateSettings(normalizeSettings({ kind: "league" }), 8), null);
  assert.match(validateSettings(normalizeSettings({ kind: "league", finish: "top8" }), 6)!, /Quarter finals need/);
  assert.match(validateSettings(normalizeSettings({ kind: "groups", groups: 4 }), 8)!, /4 groups need at least 12/);
  assert.match(validateSettings(normalizeSettings({ kind: "groups", groups: 2, advance: 3 }), 6)!, /at most 2 can go through/);
  assert.match(validateSettings(normalizeSettings({ kind: "league", legs: 2 }), 14)!, /at most 12/);
  assert.equal(validateSettings(normalizeSettings({ kind: "double_elim" }), 32), null);
});

t("planMain covers every kind and describe() counts the same matches", () => {
  const kinds = [
    { kind: "knockout" },
    { kind: "double_elim" },
    { kind: "league", finish: "top4" },
    { kind: "groups", groups: 3, advance: 2 },
  ];
  for (const k of kinds) {
    const s = normalizeSettings(k);
    const plan = planMain(s, ids(12));
    assert.ok(plan.length > 0);
    const d = describe(s, 12);
    assert.ok(d.totalMatches >= plan.filter((g) => !g.isBye).length, s.kind);
  }
  assert.equal(describe(normalizeSettings({ kind: "league", finish: "final" }), 8).totalMatches, 28 + 2);
  assert.equal(describe(normalizeSettings({ kind: "double_elim" }), 8).totalMatches, 14);
});

t("best-of scores: the winner reaches exactly half-plus-one", () => {
  assert.equal(checkScore(5, 3, 1), null);
  assert.equal(checkScore(5, 2, 3), null);
  assert.match(checkScore(5, 2, 1)!, /reaches 3/);
  assert.match(checkScore(5, 4, 1)!, /reaches 3/);
  assert.match(checkScore(5, 3, 3)!, /reaches 3/);
  assert.equal(checkScore(1, 1, 0), null);
  assert.equal(checkScore(9, 5, 4), null);
  assert.deepEqual(winningScores(7), [[4, 0], [4, 1], [4, 2], [4, 3]]);
  assert.deepEqual(winningScores(1), [[1, 0]]);
});

t("match length is chosen per round, in playing order", () => {
  assert.deepEqual(bestOfSlots(normalizeSettings({ kind: "knockout", thirdPlace: true }), 8), [
    "Quarter Finals", "Semi Finals", "Final", "3rd place",
  ]);
  assert.deepEqual(bestOfSlots(normalizeSettings({ kind: "league", finish: "final", thirdPlace: true }), 6), [
    "Table matches", "Tie-breakers", "Final", "3rd place",
  ]);
  assert.deepEqual(bestOfSlots(normalizeSettings({ kind: "groups", groups: 2, advance: 2 }), 8), [
    "Table matches", "Tie-breakers", "Semi Finals", "Final", "3rd place",
  ]);
  const d = bestOfSlots(normalizeSettings({ kind: "double_elim" }), 8);
  assert.ok(d.includes("Upper final") && d.includes("Lower final") && d.includes("Grand final"));
  const s = normalizeSettings({ kind: "knockout", bestOf: { Final: 9, "Semi Finals": 5, Bogus: 4 } });
  assert.deepEqual(s.bestOf, { Final: 9, "Semi Finals": 5 });
});

t("level players are separated by play-off matches — repeated until someone is ahead", () => {
  // A, B, C all on 6 points; D on 0
  const table = [
    { a: "A", b: "B", winner: "A" }, { a: "B", b: "C", winner: "B" }, { a: "C", b: "A", winner: "C" },
    { a: "A", b: "D", winner: "A" }, { a: "B", b: "D", winner: "B" }, { a: "C", b: "D", winner: "C" },
  ];
  const ids = ["A", "B", "C", "D"];
  const level = computeStandings(ids, table, { tiebreak: "decider", orders: [] });
  assert.deepEqual(blockingTies(level, [1], null)[0].teamIds, ["A", "B", "C"]);
  // play-off round 1 goes round in a circle again → still level
  const round1 = [{ a: "A", b: "B", winner: "B" }, { a: "B", b: "C", winner: "C" }, { a: "C", b: "A", winner: "A" }];
  const still = computeStandings(ids, table, { tiebreak: "decider", orders: [], deciders: round1 });
  assert.equal(blockingTies(still, [1], null).length, 1);
  // play-off round 2: C wins both → C first; A and B level on play-off wins but nothing hangs on 2nd v 3rd
  const round2 = [{ a: "A", b: "B", winner: "A" }, { a: "B", b: "C", winner: "C" }, { a: "C", b: "A", winner: "C" }];
  const done = computeStandings(ids, table, { tiebreak: "decider", orders: [], deciders: [...round1, ...round2] });
  assert.equal(done[0].teamId, "C");
  assert.equal(done[0].tied, false);
  assert.equal(blockingTies(done, [1], null).length, 0);
  // two level players: one play-off match settles it
  const two = computeStandings(["P", "Q"], [], { tiebreak: "decider", orders: [], deciders: [{ a: "P", b: "Q", winner: "Q" }] });
  assert.deepEqual(two.map((r) => [r.teamId, r.position]), [["Q", 1], ["P", 2]]);
});

t("tie-breakers have their own match length, defaulting to the table's", () => {
  const s = normalizeSettings({ kind: "league", bestOf: { "Table matches": 3 } });
  assert.equal(bestOfFor(s, { stage: "decider", label: "Tie-breaker" }), 3);
  const s2 = normalizeSettings({ kind: "league", bestOf: { "Table matches": 3, "Tie-breakers": 1 } });
  assert.equal(bestOfFor(s2, { stage: "decider", label: "Tie-breaker" }), 1);
});

t("standings count frames for and against", () => {
  const rows = computeStandings(["A", "B"], [{ a: "A", b: "B", winner: "A", scoreA: 3, scoreB: 2 }], {
    tiebreak: "decider",
    orders: [],
  });
  assert.deepEqual(
    [rows[0].framesFor, rows[0].framesAgainst, rows[1].framesFor, rows[1].framesAgainst],
    [3, 2, 2, 3],
  );
});

console.log(`\n${n} structure tests passed`);
