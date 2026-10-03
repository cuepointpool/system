/* ============================================================
   Membership & loyalty economics — the numbers that keep the
   scheme from costing the house money. Pure maths, no database.

   Two rules:

   1. POINTS. A player earns 1 point per LKR 10 of table time and a
      point is priced so that redeeming it costs us LKR 0.50. So for
      every reward we hand out, the player has first paid us 20× what
      that reward costs us (a 5% give-back).

   2. PAID PLANS. A plan's discount and bonus points apply only to the
      first `capSpend` of table time each month. The cap is chosen so
      that the most a member can ever get back (discount + the extra
      points) is less than the monthly fee. Past the cap they pay the
      standard price and earn standard points, like a Basic member.

   `npm run test:membership` checks both rules.
   ============================================================ */

import { TABLE_HOURLY_RATE } from "../config";

/** LKR of table time that earns one point on the Basic plan */
export const LKR_PER_POINT = 10;
/** what one redeemed point costs us, in LKR */
export const POINT_COST_LKR = 0.5;
/** share of table revenue handed back as rewards on the Basic plan */
export const GIVE_BACK_RATE = POINT_COST_LKR / LKR_PER_POINT; // 0.05

export interface PlanRule {
  /** LKR per month */
  price: number;
  /** % off table time, inside the cap */
  discountPct: number;
  /** points multiplier, inside the cap */
  loyaltyMultiplier: number;
  /** LKR of table time per month that the discount + multiplier apply to */
  capSpend: number;
}

export const PLAN_RULES: Record<"basic" | "pro" | "elite", PlanRule> = {
  basic: { price: 0, discountPct: 0, loyaltyMultiplier: 1, capSpend: 0 },
  // 15 hours at the hourly rate
  pro: { price: 1500, discountPct: 10, loyaltyMultiplier: 1.5, capSpend: 15 * TABLE_HOURLY_RATE },
  // 18 hours at the hourly rate
  elite: { price: 3500, discountPct: 18, loyaltyMultiplier: 2, capSpend: 18 * TABLE_HOURLY_RATE },
};

/** The most a plan can give back in one month, against its fee. */
export function planWorstCase(rule: PlanRule) {
  const discount = rule.capSpend * (rule.discountPct / 100);
  const paidInsideCap = rule.capSpend - discount;
  const bonusPoints = (paidInsideCap / LKR_PER_POINT) * (rule.loyaltyMultiplier - 1);
  const bonusPointsCost = bonusPoints * POINT_COST_LKR;
  return {
    discount,
    bonusPoints,
    bonusPointsCost,
    /** fee − everything the member can get back. Must never be negative. */
    margin: rule.price - discount - bonusPointsCost,
  };
}

/** What each reward costs us to hand over, in LKR. */
export const REWARD_COST_LKR: Record<string, number> = {
  rw_play30: TABLE_HOURLY_RATE / 2, // 30 minutes of a table
  rw_play60: TABLE_HOURLY_RATE, // an hour of a table
  rw_food: 500, // snack pack
  rw_disc15: 0.15 * 3 * TABLE_HOURLY_RATE, // 15% off, capped at 3 hours
  rw_tourney: 1500, // entry credit, face value
  rw_merch: 1500, // chalk + glove set — keep our buying price at or under this
};

/** fewest points a reward can be sold for without losing money */
export function minRewardPoints(costLkr: number): number {
  return Math.ceil(costLkr / POINT_COST_LKR);
}

/** LKR of table time a player pays to earn `points` (Basic rate unless a multiplier is given) */
export function spendForPoints(points: number, multiplier = 1): number {
  return (points * LKR_PER_POINT) / multiplier;
}

/**
 * Points for `paid` LKR actually paid for table time so far this month. The
 * multiplier applies up to the cap as it looks on the bill (cap less the plan
 * discount); everything past that earns the standard 1 point per LKR 10.
 */
export function pointsForPaid(paid: number, rule: PlanRule): number {
  const capPaid = rule.capSpend * (1 - rule.discountPct / 100);
  const inside = Math.min(Math.max(0, paid), capPaid);
  const outside = Math.max(0, paid) - inside;
  return Math.floor((inside * rule.loyaltyMultiplier + outside) / LKR_PER_POINT);
}

/** points earned on `spend` LKR of table time (list price) in a month, on a given plan */
export function pointsForSpend(spend: number, rule: PlanRule): number {
  const inside = Math.min(spend, rule.capSpend);
  const outside = spend - inside;
  const paidInside = inside * (1 - rule.discountPct / 100);
  return Math.floor(
    (paidInside / LKR_PER_POINT) * rule.loyaltyMultiplier + outside / LKR_PER_POINT,
  );
}
