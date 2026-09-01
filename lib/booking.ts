import { HOURS, TABLE_HALF_HOUR_RATE, TABLE_HOURLY_RATE } from "./config";
import { minutesToTime, timeToMinutes } from "./utils";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

/** Where the booking came from. `walk_in` = seated at the counter with no
 *  prior reservation; `staff` = staff booked a slot for a customer. */
export type BookingOrigin = "online" | "walk_in" | "staff";
export type PaymentStatus = "unpaid" | "paid";

export const HOURLY_RATE = TABLE_HOURLY_RATE;
export const HALF_HOUR_RATE = TABLE_HALF_HOUR_RATE;

/**
 * Enforced gap between two bookings on the same table, in minutes.
 *
 * Kept at 0 on purpose: bookings live on a clean 30-minute grid, so any
 * non-zero value would silently swallow the whole next slot (a 12:00–13:00
 * booking would push the next start to 13:30, not 13:00) and, slot after
 * slot, drift the floor off round times. Back-to-back bookings are allowed
 * — turnover is a soft courtesy (see TURNOVER_MIN), not a booking blocker.
 */
export const GRACE_MIN = 0;

/** Courtesy changeover: if another group is booked right after you, hand the
 *  table over this many minutes early. Not enforced — guidance in the UI. */
export const TURNOVER_MIN = 3;

/** Bookings are made on a 30-minute grid. */
export const SLOT_STEP_MIN = 30;
/** Session length granularity, in hours. */
export const DURATION_STEP = 0.5;

export interface Booking {
  id: string;
  reference: string;
  tableId: string;
  tableName: string; // label snapshot, e.g. "Table 1"
  customerName: string;
  phone: string;
  email: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // "18:00"
  durationHrs: number;
  partySize: number;
  totalAmount: number;
  status: BookingStatus;
  notes: string | null;
  origin: BookingOrigin;
  paymentStatus: PaymentStatus;
  playerId: string | null; // linked registered player, if any
  checkedInAt: string | null; // ISO — walk-in session actually seated
  checkedOutAt: string | null; // ISO — session closed & billed
  createdAt: string;
}

/** An open walk-in session is one that's been seated but not yet closed. */
export function isOpenSession(b: Booking): boolean {
  return !!b.checkedInAt && !b.checkedOutAt;
}

/**
 * Walk-in billing: round the minutes actually played up to the next 30-minute
 * block (minimum one block) and turn that into hours for {@link priceFor}.
 * 6:05pm → 7:20pm = 75 min → 90 min → 1.5h → LKR 1,300.
 */
export function billableHours(minutesPlayed: number): number {
  const blocks = Math.max(1, Math.ceil(minutesPlayed / SLOT_STEP_MIN));
  return (blocks * SLOT_STEP_MIN) / 60;
}

export const OPEN_DAYS_AHEAD = 21;
export const MIN_DURATION = 0.5;
export const MAX_DURATION = 5;

/** Every 30-minute step from MIN_DURATION to MAX_DURATION, e.g. [0.5, 1, 1.5, …]. */
export const DURATION_OPTIONS: number[] = Array.from(
  { length: Math.round((MAX_DURATION - MIN_DURATION) / DURATION_STEP) + 1 },
  (_, i) => +(MIN_DURATION + i * DURATION_STEP).toFixed(1),
);

/** Price: LKR 800 per full hour + LKR 500 for a trailing 30 minutes.
 *  0.5h → 500, 1h → 800, 1.5h → 1300, 2h → 1600, … */
export function priceFor(durationHrs: number): number {
  const fullHours = Math.floor(durationHrs + 1e-9);
  const hasHalf = durationHrs - fullHours >= 0.5 - 1e-9;
  return fullHours * TABLE_HOURLY_RATE + (hasHalf ? TABLE_HALF_HOUR_RATE : 0);
}

/** True when a length is a valid 30-minute-aligned session inside the bounds. */
export function isValidDuration(durationHrs: number): boolean {
  return (
    durationHrs >= MIN_DURATION &&
    durationHrs <= MAX_DURATION &&
    Math.round(durationHrs * 2) === durationHrs * 2
  );
}

/** open / close minutes for a date (close may exceed 1440 for past-midnight). */
export function openHoursForDate(dateISO: string): { open: string; close: string } {
  const day = new Date(dateISO + "T00:00:00").getDay();
  return HOURS[day];
}

/**
 * Slot start times ("HH:MM") for a date, on a 30-minute grid, that leave room
 * for at least the shortest session (30 minutes) before close.
 */
export function slotStartsForDate(dateISO: string): string[] {
  const { open, close } = openHoursForDate(dateISO);
  const openM = timeToMinutes(open);
  const closeM = timeToMinutes(close);
  const starts: string[] = [];
  for (let m = openM; m <= closeM - SLOT_STEP_MIN; m += SLOT_STEP_MIN) {
    starts.push(minutesToTime(m % 1440));
  }
  return starts;
}

export function isPastSlot(dateISO: string, startTime: string): boolean {
  const now = new Date();
  const slot = new Date(dateISO + "T" + startTime + ":00");
  if (timeToMinutes(startTime) < 6 * 60) slot.setDate(slot.getDate() + 1);
  return slot.getTime() < now.getTime() + 30 * 60 * 1000; // 30-min lead time
}

/** Does [start, start+duration] fit inside the day's opening hours? */
export function fitsOpenHours(
  dateISO: string,
  startTime: string,
  durationHrs: number,
): boolean {
  const { open, close } = openHoursForDate(dateISO);
  const openM = timeToMinutes(open);
  const closeM = timeToMinutes(close);
  let s = timeToMinutes(startTime);
  if (s < 360) s += 1440; // past-midnight label
  return s >= openM && s + durationHrs * 60 <= closeM;
}

export function makeReference(): string {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
  return "CP-" + out;
}

export interface BookingInput {
  tableId: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  startTime: string;
  durationHrs: number;
  partySize: number;
  notes?: string;
  playerId?: string | null; // the signed-in member who made the booking
}

/** Staff booking a fixed slot for a customer (walk-in or registered). */
export interface StaffBookingInput {
  tableId: string;
  customerName: string;
  phone?: string;
  email?: string;
  date: string;
  startTime: string;
  durationHrs: number;
  partySize: number;
  notes?: string;
  playerId?: string | null;
  origin?: BookingOrigin; // defaults to "staff"
}

/** Staff seating a walk-in right now with no fixed end time. */
export interface WalkInSessionInput {
  tableId: string;
  customerName: string;
  phone?: string;
  partySize: number;
  playerId?: string | null;
  notes?: string;
}

/** Staff logging a walk-in that has already been and gone — enter what they
 *  used (start + end) and what to charge. Stored as a closed session. */
export interface LoggedVisitInput {
  tableId: string;
  customerName: string;
  phone?: string;
  partySize: number;
  playerId?: string | null;
  notes?: string;
  startAt: string; // ISO / "YYYY-MM-DDTHH:MM" local
  endAt: string;
  amount?: number; // omit to auto-bill the played minutes
  paid?: boolean;
}

/** Light validation for staff-entered bookings — no lead-time / past-slot
 *  guard (staff routinely seat people for "now" or log a slot after the fact). */
export function validateStaffBooking(
  input: Partial<StaffBookingInput>,
): string | null {
  if (!input.tableId) return "Pick a table.";
  if (!input.customerName || input.customerName.trim().length < 2)
    return "Enter the customer's name.";
  if (!input.partySize || input.partySize < 1 || input.partySize > 30)
    return "Party size looks off.";
  if (input.startTime !== undefined || input.date !== undefined) {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date))
      return "Pick a valid date.";
    if (!input.startTime || !/^\d{2}:\d{2}$/.test(input.startTime))
      return "Pick a start time.";
    if (!input.durationHrs || !isValidDuration(input.durationHrs))
      return `Sessions run ${MIN_DURATION}–${MAX_DURATION} hours, in 30-minute blocks.`;
  }
  return null;
}

/** Validates the non-table fields. Table existence is checked against the DB. */
export function validateBooking(input: Partial<BookingInput>): string | null {
  if (!input.tableId || typeof input.tableId !== "string") return "Pick a table.";
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Pick a valid date.";
  if (!input.startTime || !/^\d{2}:\d{2}$/.test(input.startTime)) return "Pick a start time.";
  if (timeToMinutes(input.startTime) % SLOT_STEP_MIN !== 0)
    return "Start times are on the hour or the half hour.";
  if (!input.durationHrs || !isValidDuration(input.durationHrs))
    return `Sessions run ${MIN_DURATION}–${MAX_DURATION} hours, in 30-minute blocks.`;
  if (!input.customerName || input.customerName.trim().length < 2) return "Tell us your name.";
  if (!input.phone || input.phone.replace(/\D/g, "").length < 9)
    return "Add a phone number we can reach you on.";
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email))
    return "That email doesn't look right.";
  if (!input.partySize || input.partySize < 1 || input.partySize > 20)
    return "Party size looks off.";
  if (!fitsOpenHours(input.date, input.startTime, input.durationHrs))
    return "That runs outside our opening hours.";
  if (isPastSlot(input.date, input.startTime)) return "That slot has already passed.";
  return null;
}
