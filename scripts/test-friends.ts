/* Pure-logic tests for the friend-play rules (no database needed).
   Run:  npm run test:friends */
import assert from "node:assert/strict";
import { generateBracket, nextPow2, roundName, seedOrder } from "../lib/friends/bracket";
import { FORMATS, requiredGamePlayers, requiredTournamentPlayers } from "../lib/friends/formats";
import { validateGameRoster, validateTeamSize, validateTournamentRoster } from "../lib/friends/validate";
import { rosterKey } from "../lib/friends/points";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};

t("required players come from the format", () => {
  assert.equal(requiredGamePlayers(FORMATS["1v1"]), 2);
  assert.equal(requiredGamePlayers(FORMATS["2v2"]), 4);
  assert.equal(requiredTournamentPlayers(FORMATS["2v2"], 8), 16);
  assert.equal(requiredTournamentPlayers(FORMATS["1v1"], 8), 8);
});

t("game roster messages", () => {
  const one = validateGameRoster(FORMATS["1v1"], 1);
  assert.equal(one.state, "short");
  assert.match(one.message, /^You need 2 players to create a 1v1 game\./);
  assert.match(validateGameRoster(FORMATS["1v1"], 2).message, /enough players to create a 1v1 game/);
  const three = validateGameRoster(FORMATS["2v2"], 3);
  assert.equal(three.message, "You need 4 players to create a 2v2 game. Please add 1 more player.");
  const five = validateGameRoster(FORMATS["2v2"], 5);
  assert.equal(five.state, "over");
  assert.equal(five.extra, 1);
  assert.equal(five.message, "2v2 requires exactly 4 players. You currently have 5 players selected.");
  assert.deepEqual(five.actions, ["remove_extra", "change_format", "cancel"]);
  assert.equal(validateGameRoster(FORMATS["2v2"], 4).state, "ok");
});

t("tournament roster reports teams and players separately", () => {
  const r = validateTournamentRoster(FORMATS["2v2"], 8, 6, 12);
  assert.equal(r.state, "short");
  assert.deepEqual(r.teams, { have: 6, capacity: 8 });
  assert.deepEqual(r.players, { have: 12, required: 16 });
  assert.equal(r.missingPlayers, 4);
  assert.equal(r.message, "You need 4 more players to fill this tournament.");
  assert.equal(validateTournamentRoster(FORMATS["2v2"], 8, 8, 16).state, "ok");
  assert.equal(validateTournamentRoster(FORMATS["1v1"], 8, 9, 9).state, "over");
});

t("team size", () => {
  assert.equal(validateTeamSize(FORMATS["2v2"], 2), null);
  assert.equal(validateTeamSize(FORMATS["2v2"], 1), "A 2v2 team must contain exactly 2 players.");
  assert.equal(validateTeamSize(FORMATS["2v2"], 3), "A 2v2 team must contain exactly 2 players.");
});

t("seed order", () => {
  assert.deepEqual(seedOrder(2), [1, 2]);
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

t("round names", () => {
  assert.equal(roundName(3, 3), "Final");
  assert.equal(roundName(2, 3), "Semi Finals");
  assert.equal(roundName(1, 3), "Quarter Finals");
  assert.equal(roundName(1, 4), "Round of 16");
});

t("brackets for every size 2..16", () => {
  for (let count = 2; count <= 16; count++) {
    const seeded = Array.from({ length: count }, (_, i) => `T${i + 1}`);
    const b = generateBracket(seeded);
    assert.equal(b.size, nextPow2(count));
    assert.equal(b.byes, b.size - count);
    assert.equal(b.games.length, b.size - 1, `game count for ${count}`);

    const r1 = b.games.filter((g) => g.round === 1);
    // every entrant appears exactly once in round 1
    const placed = r1.flatMap((g) => [g.a, g.b]).filter((x): x is string => x !== null);
    assert.deepEqual([...placed].sort(), [...seeded].sort());
    // BYE count matches, and no game is empty on both sides
    assert.equal(r1.filter((g) => g.isBye).length, b.byes);
    for (const g of r1) assert.ok(g.a !== null || g.b !== null, `empty game for ${count}`);
    // later rounds start empty and every non-final game points at a real slot
    for (const g of b.games) {
      if (g.round > 1) assert.ok(g.a === null && g.b === null);
      if (g.round < b.rounds) {
        assert.ok(g.next);
        assert.ok(b.games.some((x) => x.round === g.next!.round && x.position === g.next!.position));
      } else assert.equal(g.next, null);
    }
    // the top seeds get the byes
    for (const g of r1.filter((x) => x.isBye)) {
      const present = (g.a ?? g.b) as string;
      assert.ok(Number(present.slice(1)) <= b.byes, `bye should go to a top seed (${count})`);
    }
  }
});

t("6-team bracket matches the spec", () => {
  const b = generateBracket(["A", "B", "C", "D", "E", "F"]);
  assert.equal(b.size, 8);
  assert.equal(b.byes, 2);
  assert.deepEqual(b.games.filter((g) => g.round === 1).map((g) => g.isBye), [true, false, true, false]);
});

t("roster key ignores order and duplicates", () => {
  assert.equal(rosterKey(["b", "a", "a"]), rosterKey(["a", "b"]));
});

console.log(`\n${n} passed`);
