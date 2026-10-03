/* ============================================================
   Automatic loyalty points for table time.

   Points are owed for a booking only while it is PAID, not cancelled
   and linked to a registered player. Rather than "add points when
   someone pays" (which goes wrong on un-pay, extend, re-price, cancel
   and delete), this recomputes what every booking of that player in
   that calendar month SHOULD have earned and writes only the
   difference. Running it twice changes nothing.

   The rules — 1 point per LKR 10 paid, plan multiplier inside the
   monthly cap — live in ./economics.ts.
   ============================================================ */

import type { PoolClient } from "pg";
import { transaction } from "../pg";
import { PLAN_RULES, pointsForPaid, type PlanRule } from "./economics";

const TZ = "Asia/Colombo";
const BASIC = PLAN_RULES.basic;

interface BookingRow {
  id: string;
  reference: string | null;
  day: string; // YYYY-MM-DD
  total_amount: number;
  status: string;
  payment_status: string | null;
}

async function loadRule(
  c: PoolClient,
  playerId: string,
): Promise<{ eligible: boolean; rule: PlanRule; since: string }> {
  const { rows } = await c.query<{
    role: string;
    tier: keyof typeof PLAN_RULES;
    price: number | null;
    discount_pct: number | null;
    loyalty_multiplier: string | null;
    since: string | null;
  }>(
    `SELECT p.role, p.membership_tier AS tier,
            mp.price, mp.discount_pct, mp.loyalty_multiplier,
            (SELECT to_char(um.started_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD')
               FROM user_memberships um
              WHERE um.player_id = p.id AND um.status = 'active'
              ORDER BY um.started_at DESC LIMIT 1) AS since
       FROM player_profiles p
       LEFT JOIN membership_plans mp ON mp.id = p.membership_tier
      WHERE p.id = $1
      FOR UPDATE OF p`,
    [playerId],
  );
  const r = rows[0];
  if (!r || r.role !== "player") return { eligible: false, rule: BASIC, since: "" };
  return {
    eligible: true,
    rule: {
      price: Number(r.price ?? 0),
      discountPct: Number(r.discount_pct ?? 0),
      loyaltyMultiplier: Number(r.loyalty_multiplier ?? 1),
      capSpend: PLAN_RULES[r.tier]?.capSpend ?? 0,
    },
    // a plan only counts for table time on or after the day it started
    since: r.since ?? "",
  };
}

/**
 * Bring one player's booking points for one calendar month (`YYYY-MM`, by
 * booking date) in line with what they have actually paid. `alsoIds` are
 * booking ids that may no longer exist or no longer belong to this
 * player/month — any points they were given are taken back.
 */
export async function syncPlayerMonthPoints(
  playerId: string,
  month: string,
  alsoIds: string[] = [],
): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  await transaction(async (c) => {
    const { eligible, rule, since } = await loadRule(c, playerId);

    const { rows: bookings } = await c.query<BookingRow>(
      `SELECT id, reference, to_char(date, 'YYYY-MM-DD') AS day, total_amount, status, payment_status
         FROM bookings
        WHERE player_id = $1 AND to_char(date, 'YYYY-MM') = $2
        ORDER BY date, start_time, id`,
      [playerId, month],
    );

    // what each booking should have earned
    const target = new Map<string, number>();
    const label = new Map<string, string>();
    let paidUnderPlan = 0;
    for (const b of bookings) {
      label.set(b.id, b.reference ?? b.id);
      const amount = Number(b.total_amount) || 0;
      const counts =
        eligible && b.status !== "CANCELLED" && b.payment_status === "paid" && amount > 0;
      if (!counts) {
        target.set(b.id, 0);
      } else if (rule.capSpend > 0 && b.day >= since) {
        const before = pointsForPaid(paidUnderPlan, rule);
        paidUnderPlan += amount;
        target.set(b.id, pointsForPaid(paidUnderPlan, rule) - before);
      } else {
        target.set(b.id, pointsForPaid(amount, BASIC));
      }
    }
    for (const id of alsoIds) if (!target.has(id)) target.set(id, 0);
    if (!target.size) return;

    // what each booking has been given so far
    const { rows: given } = await c.query<{ reference_id: string; pts: number }>(
      `SELECT reference_id, sum(points)::int AS pts FROM loyalty_transactions
        WHERE player_id = $1 AND source = 'booking' AND reference_id = ANY($2)
        GROUP BY reference_id`,
      [playerId, [...target.keys()]],
    );
    const have = new Map(given.map((g) => [g.reference_id, g.pts]));

    let net = 0;
    for (const [id, want] of target) {
      const delta = want - (have.get(id) ?? 0);
      if (!delta) continue;
      net += delta;
      const first = !have.has(id) && delta > 0;
      await c.query(
        `INSERT INTO loyalty_transactions (id, player_id, points, reason, source, reference_id)
         VALUES ($1,$2,$3,$4,'booking',$5)`,
        [
          "lt_" + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12),
          playerId,
          delta,
          `${first ? "Table time" : "Table time correction"} · ${label.get(id) ?? id}`,
          id,
        ],
      );
    }
    if (net) {
      await c.query(
        `UPDATE player_profiles
            SET loyalty_points = GREATEST(0, loyalty_points + $2),
                loyalty_lifetime = GREATEST(0, loyalty_lifetime + $2)
          WHERE id = $1`,
        [playerId, net],
      );
    }
  });
}

/** Call after anything that changes a booking's payment, price or status. */
export async function syncPointsForBooking(
  b: { id: string; playerId: string | null; date: string } | null | undefined,
): Promise<void> {
  if (!b?.playerId) return;
  try {
    await syncPlayerMonthPoints(b.playerId, b.date.slice(0, 7), [b.id]);
  } catch (err) {
    // never fail the payment itself over points; the next change re-syncs
    console.error("[loyalty] could not sync points for booking", b.id, err);
  }
}
