/* ============================================================
   Playing-hours rules — pure and client-safe (the admin form uses
   the same maths to show the price before saving).

   - A session is entered as a start and a close time. Minutes played
     are rounded up to 30-minute blocks (minimum one block) and priced
     with the normal table rate (priceFor).
   - Every 3 PAID hours a player earns 30 free minutes. Free minutes
     themselves don't earn more free time.
   ============================================================ */

import { SLOT_STEP_MIN, priceFor } from "./booking";
import { timeToMinutes } from "./utils";

/** Paid minutes needed to earn one free block. */
export const FREE_EVERY_MIN = 180;
/** Free minutes earned per FREE_EVERY_MIN paid. */
export const FREE_REWARD_MIN = 30;
/** Longest session the log accepts. */
export const MAX_SESSION_MIN = 12 * 60;
/** Times before this are past midnight and belong to the previous business day. */
const DAY_ROLLOVER_MIN = 6 * 60;

export function freeMinutesEarned(paidMin: number): number {
  return Math.floor(Math.max(0, paidMin) / FREE_EVERY_MIN) * FREE_REWARD_MIN;
}

/** Paid minutes still needed before the next free block lands. */
export function minutesToNextFree(paidMin: number): number {
  return FREE_EVERY_MIN - (Math.max(0, paidMin) % FREE_EVERY_MIN);
}

/**
 * Minutes between a start and close time on the same business day.
 * "23:00" → "01:15" is 135 minutes. Null when close isn't after start.
 */
export function sessionMinutes(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  let s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (s < DAY_ROLLOVER_MIN) s += 1440;
  if (e < DAY_ROLLOVER_MIN) e += 1440;
  const mins = e - s;
  return mins > 0 && mins <= MAX_SESSION_MIN ? mins : null;
}

/** Played minutes rounded up to whole 30-minute blocks (minimum one). */
export function billedMinutes(playedMin: number): number {
  return Math.max(1, Math.ceil(playedMin / SLOT_STEP_MIN)) * SLOT_STEP_MIN;
}

export interface SessionQuote {
  playedMin: number;
  billedMin: number;
  freeMin: number; // free minutes actually applied
  chargedMin: number; // billedMin − freeMin
  gross: number; // price of chargedMin before discount
  discount: number;
  amount: number; // what to collect
}

/** Price a session. Free minutes are clamped to whole blocks within the bill. */
export function quoteSession(
  playedMin: number,
  opts: { freeMin?: number; discount?: number } = {},
): SessionQuote {
  const billedMin = billedMinutes(playedMin);
  const wantFree = Math.floor(Math.max(0, opts.freeMin ?? 0) / SLOT_STEP_MIN) * SLOT_STEP_MIN;
  const freeMin = Math.min(wantFree, billedMin);
  const chargedMin = billedMin - freeMin;
  const gross = priceFor(chargedMin / 60);
  const discount = Math.min(gross, Math.max(0, Math.round(opts.discount ?? 0)));
  return {
    playedMin,
    billedMin,
    freeMin,
    chargedMin,
    gross,
    discount,
    amount: gross - discount,
  };
}

export interface PlayTimeSummary {
  bookedMin: number; // from past bookings not covered by a log
  loggedMin: number; // paid minutes from the daily log
  paidMin: number; // bookedMin + loggedMin — what earns free time
  freeEarned: number;
  freeUsed: number;
  freeBalance: number;
  toNextFreeMin: number;
}

export function summarisePlayTime(
  bookedMin: number,
  loggedMin: number,
  freeUsed: number,
): PlayTimeSummary {
  const paidMin = bookedMin + loggedMin;
  const freeEarned = freeMinutesEarned(paidMin);
  return {
    bookedMin,
    loggedMin,
    paidMin,
    freeEarned,
    freeUsed,
    freeBalance: Math.max(0, freeEarned - freeUsed),
    toNextFreeMin: minutesToNextFree(paidMin),
  };
}

/** 150 → "2h 30m", 30 → "30m", 120 → "2h". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
