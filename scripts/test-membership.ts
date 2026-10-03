/* Checks that memberships and loyalty rewards can't cost the house money.
   Pure maths, no database.  Run:  npm run test:membership */
import assert from "node:assert/strict";
import { TABLE_HOURLY_RATE } from "../lib/config";
import {
  GIVE_BACK_RATE,
  LKR_PER_POINT,
  PLAN_RULES,
  POINT_COST_LKR,
  REWARD_COST_LKR,
  minRewardPoints,
  planWorstCase,
  pointsForPaid,
  pointsForSpend,
  spendForPoints,
} from "../lib/ecosystem/economics";

/** points each reward is sold for — must match the `rewards` table / setup seed */
const REWARD_POINTS: Record<string, number> = {
  rw_play30: 800,
  rw_play60: 1600,
  rw_food: 1000,
  rw_disc15: 750,
  rw_tourney: 3000,
  rw_merch: 3000,
};

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("  ok  " + name);
};
const lkr = (v: number) => "LKR " + Math.round(v).toLocaleString("en-LK");

t("give-back rate is 5% of table revenue", () => {
  assert.equal(GIVE_BACK_RATE, 0.05);
});

t("every reward is priced at or above its cost", () => {
  for (const [id, cost] of Object.entries(REWARD_COST_LKR)) {
    const pts = REWARD_POINTS[id];
    assert.ok(pts != null, `${id} has a points price`);
    assert.ok(pts >= minRewardPoints(cost), `${id}: ${pts} pts is below ${minRewardPoints(cost)}`);
    const revenue = spendForPoints(pts);
    console.log(
      `        ${id.padEnd(11)} ${String(pts).padStart(5)} pts · costs us ${lkr(cost).padEnd(9)} · player pays ${lkr(revenue)} first`,
    );
    // the player has paid at least 20× the reward's cost before earning it
    assert.ok(revenue >= cost / GIVE_BACK_RATE);
  }
});

t("user's examples: 30 min costs 400, snack pack costs 500", () => {
  assert.equal(REWARD_COST_LKR.rw_play30, 400);
  assert.equal(REWARD_COST_LKR.rw_food, 500);
  assert.equal(spendForPoints(REWARD_POINTS.rw_play30), 8000);
  assert.equal(spendForPoints(REWARD_POINTS.rw_food), 10000);
});

t("a paid plan can never give back more than its fee", () => {
  for (const [id, rule] of Object.entries(PLAN_RULES)) {
    const w = planWorstCase(rule);
    console.log(
      `        ${id.padEnd(6)} fee ${lkr(rule.price).padEnd(9)} · max discount ${lkr(w.discount).padEnd(9)} · max bonus points ${lkr(w.bonusPointsCost).padEnd(7)} · we keep ${lkr(w.margin)}`,
    );
    assert.ok(w.margin >= 0, `${id} loses ${lkr(-w.margin)} at the cap`);
  }
});

t("we never earn less from a member than from the same play at Basic", () => {
  const base = PLAN_RULES.basic;
  for (const [id, rule] of Object.entries(PLAN_RULES)) {
    // every half hour up to 100 hours a month
    for (let spend = 0; spend <= 100 * TABLE_HOURLY_RATE; spend += TABLE_HOURLY_RATE / 2) {
      const inside = Math.min(spend, rule.capSpend);
      const paid = spend - inside * (rule.discountPct / 100);
      const net = rule.price + paid - pointsForSpend(spend, rule) * POINT_COST_LKR;
      const basicNet = spend - pointsForSpend(spend, base) * POINT_COST_LKR;
      assert.ok(net >= basicNet - 1, `${id} at ${lkr(spend)}: ${net} < ${basicNet}`);
    }
  }
});

t("past the cap a member earns points like everyone else", () => {
  const rule = PLAN_RULES.pro;
  const atCap = pointsForSpend(rule.capSpend, rule);
  const extra = pointsForSpend(rule.capSpend + 1000, rule) - atCap;
  assert.equal(extra, 1000 / LKR_PER_POINT);
});

t("points on what was actually paid: multiplier inside the cap only", () => {
  assert.equal(pointsForPaid(800, PLAN_RULES.basic), 80);
  assert.equal(pointsForPaid(1600, PLAN_RULES.basic), 160);
  // Pro cap on the bill = 12,000 less 10% = 10,800
  assert.equal(pointsForPaid(8000, PLAN_RULES.pro), 1200);
  assert.equal(pointsForPaid(10800, PLAN_RULES.pro), 1620);
  assert.equal(pointsForPaid(12000, PLAN_RULES.pro), 1620 + 120);
  // the automatic award never hands out more bonus than the worst case allows
  for (const rule of Object.values(PLAN_RULES)) {
    const far = 80000;
    const bonus = pointsForPaid(far, rule) - pointsForPaid(far, PLAN_RULES.basic);
    assert.ok(bonus <= Math.ceil(planWorstCase(rule).bonusPoints));
  }
});

console.log(`\n${n} passed`);
