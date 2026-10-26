import type { PoolClient } from "pg";
import { query, transaction } from "./pg";
import { getTableById } from "./tables";
import { audit } from "./ecosystem/store";
import { syncPlayerMonthPoints } from "./ecosystem/loyalty-sync";
import {
  quoteSession,
  sessionMinutes,
  summarisePlayTime,
  type PlayTimeSummary,
} from "./playtime";

/* ------------------------------------------------------------------
   Daily play log — what was actually played, entered at the counter.

   Staff record who played here; the money itself is entered in the accounts
   day book (lib/accounts.ts), which shows this log for cross-checking. Online bookings are only
   reservations: they never count as money, but a member's past
   bookings DO count toward their playing hours, and so toward free
   time. When a session is logged against a reservation (booking_id),
   the logged time replaces the booked time so nothing counts twice.
   ------------------------------------------------------------------ */

const TZ = "Asia/Colombo";

export interface PlayLog {
  id: string;
  date: string;
  tableId: string;
  tableName: string;
  startTime: string;
  endTime: string;
  playedMin: number;
  billedMin: number;
  freeMin: number;
  discount: number;
  amount: number;
  playerId: string | null;
  playerName: string | null;
  customerName: string;
  bookingId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

interface PlayLogRow {
  id: string;
  date: string;
  table_id: string;
  table_name: string;
  start_time: string;
  end_time: string;
  played_min: number;
  billed_min: number;
  free_min: number;
  discount: number;
  amount: number;
  player_id: string | null;
  player_name: string | null;
  customer_name: string;
  booking_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: Date;
}

function rowTo(r: PlayLogRow): PlayLog {
  return {
    id: r.id,
    date: r.date,
    tableId: r.table_id,
    tableName: r.table_name,
    startTime: r.start_time,
    endTime: r.end_time,
    playedMin: Number(r.played_min),
    billedMin: Number(r.billed_min),
    freeMin: Number(r.free_min),
    discount: Number(r.discount),
    amount: Number(r.amount),
    playerId: r.player_id,
    playerName: r.player_name,
    customerName: r.customer_name,
    bookingId: r.booking_id,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export class PlayLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayLogError";
  }
}

export async function listPlayLogs(date: string): Promise<PlayLog[]> {
  const rows = await query<PlayLogRow>(
    `SELECT l.*, p.full_name AS player_name
       FROM play_logs l
       LEFT JOIN player_profiles p ON p.id = l.player_id
      WHERE l.date = $1
      ORDER BY l.table_name, l.start_time`,
    [date],
  );
  return rows.map(rowTo);
}

export interface DayReservation {
  id: string;
  reference: string;
  tableId: string;
  tableName: string;
  customerName: string;
  playerId: string | null;
  startTime: string;
  durationHrs: number;
  logged: boolean;
}

/** Members' online reservations for a day, so staff can log them in one tap. */
export async function listReservations(date: string): Promise<DayReservation[]> {
  const rows = await query<{
    id: string;
    reference: string;
    table_id: string;
    table_name: string;
    customer_name: string;
    player_id: string | null;
    start_time: string;
    duration_hrs: string;
    logged: boolean;
  }>(
    `SELECT b.id, b.reference, b.table_id, b.table_name, b.customer_name,
            b.player_id, b.start_time, b.duration_hrs,
            EXISTS (SELECT 1 FROM play_logs l WHERE l.booking_id = b.id) AS logged
       FROM bookings b
      WHERE b.date = $1 AND b.origin = 'online' AND b.status <> 'CANCELLED'
      ORDER BY b.table_name, b.start_time`,
    [date],
  );
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    tableId: r.table_id,
    tableName: r.table_name,
    customerName: r.customer_name,
    playerId: r.player_id,
    startTime: r.start_time,
    durationHrs: Number(r.duration_hrs),
    logged: r.logged,
  }));
}



/**
 * A player's playing hours and free-time balance.
 *  - booked: their bookings whose slot has finished, not cancelled, not an
 *    open walk-in, and not already covered by a log entry
 *  - logged: paid minutes (billed − free) from the daily log
 */
export async function playTimeFor(playerId: string, c?: PoolClient): Promise<PlayTimeSummary> {
  type Row = { booked: string; logged: string; free_used: string };
  const sql = `SELECT
       (SELECT COALESCE(SUM(b.duration_hrs * 60), 0)
          FROM bookings b
         WHERE b.player_id = $1
           AND b.status <> 'CANCELLED'
           AND NOT (b.checked_in_at IS NOT NULL AND b.checked_out_at IS NULL)
           AND NOT EXISTS (SELECT 1 FROM play_logs l WHERE l.booking_id = b.id)
           AND b.date + make_interval(mins =>
                 split_part(b.start_time, ':', 1)::int * 60
               + split_part(b.start_time, ':', 2)::int
               + CASE WHEN split_part(b.start_time, ':', 1)::int < 6 THEN 1440 ELSE 0 END
               + (b.duration_hrs * 60)::int)
               <= (now() AT TIME ZONE '${TZ}')
       ) AS booked,
       (SELECT COALESCE(SUM(billed_min - free_min), 0) FROM play_logs WHERE player_id = $1) AS logged,
       (SELECT COALESCE(SUM(free_min), 0) FROM play_logs WHERE player_id = $1) AS free_used`;
  const rows = c
    ? (await c.query<Row>(sql, [playerId])).rows
    : await query<Row>(sql, [playerId]);
  const r = rows[0];
  return summarisePlayTime(
    Math.round(Number(r?.booked ?? 0)),
    Number(r?.logged ?? 0),
    Number(r?.free_used ?? 0),
  );
}

export interface PlayLogInput {
  date: string;
  tableId: string;
  startTime: string;
  endTime: string;
  playerId?: string | null;
  customerName?: string;
  bookingId?: string | null;
  freeMin?: number;
  discount?: number;
  notes?: string;
}

export async function createPlayLog(input: PlayLogInput, actor: string): Promise<PlayLog> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new PlayLogError("Pick a valid date.");
  const table = await getTableById(input.tableId);
  if (!table) throw new PlayLogError("Pick a table.");
  const played = sessionMinutes(input.startTime, input.endTime);
  if (played == null)
    throw new PlayLogError("Close time must be after the start time (12 hours at most).");

  const playerId = input.playerId || null;
  const id = "pl_" + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const quote = await transaction(async (c) => {
    let name = (input.customerName ?? "").trim();
    if (playerId) {
      // lock the player so two counters can't spend the same free time
      const { rows } = await c.query<{ full_name: string; role: string }>(
        `SELECT full_name, role FROM player_profiles WHERE id = $1 FOR UPDATE`,
        [playerId],
      );
      if (!rows[0] || rows[0].role !== "player") throw new PlayLogError("Unknown player.");
      name = name || rows[0].full_name;
    }
    if (!name) throw new PlayLogError("Pick a player or enter the customer's name.");

    const freeMin = Math.max(0, Math.trunc(Number(input.freeMin) || 0));
    if (freeMin % 30) throw new PlayLogError("Free time is used in 30-minute blocks.");
    if (freeMin && !playerId) throw new PlayLogError("Free time needs a registered player.");
    if (freeMin && playerId) {
      const pt = await playTimeFor(playerId, c);
      if (freeMin > pt.freeBalance)
        throw new PlayLogError(`Only ${pt.freeBalance} free minutes available.`);
    }

    if (input.bookingId) {
      const { rows } = await c.query<{ id: string }>(
        `SELECT id FROM bookings WHERE id = $1 AND status <> 'CANCELLED'`,
        [input.bookingId],
      );
      if (!rows[0]) throw new PlayLogError("That reservation no longer exists.");
    }

    const q = quoteSession(played, { freeMin, discount: input.discount });
    try {
      await c.query(
        `INSERT INTO play_logs
           (id, date, table_id, table_name, start_time, end_time, played_min,
            billed_min, free_min, discount, amount, player_id, customer_name,
            booking_id, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          id,
          input.date,
          table.id,
          table.label,
          input.startTime,
          input.endTime,
          q.playedMin,
          q.billedMin,
          q.freeMin,
          q.discount,
          q.amount,
          playerId,
          name,
          input.bookingId || null,
          input.notes?.trim() || null,
          actor,
        ],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505")
        throw new PlayLogError("That reservation has already been logged.");
      throw err;
    }
    return { q, name };
  });

  await audit(
    actor,
    "playlog.create",
    "play_log",
    id,
    `${table.label} · ${quote.name} · ${input.startTime}–${input.endTime} · ${quote.q.playedMin} min` +
      `${quote.q.freeMin ? ` · ${quote.q.freeMin} min free` : ""} · LKR ${quote.q.amount}`,
  );
  await syncLogPoints(playerId, input.date, id);
  const [log] = (await listPlayLogs(input.date)).filter((l) => l.id === id);
  return log;
}

export async function deletePlayLog(id: string, actor: string): Promise<void> {
  const rows = await query<PlayLogRow>(`DELETE FROM play_logs WHERE id = $1 RETURNING *`, [id]);
  const r = rows[0];
  if (!r) return;
  await audit(
    actor,
    "playlog.delete",
    "play_log",
    id,
    `${r.table_name} · ${r.customer_name} · ${r.date} ${r.start_time}–${r.end_time} · LKR ${r.amount}`,
  );
  await syncLogPoints(r.player_id, r.date, id);
}

async function syncLogPoints(playerId: string | null, date: string, id: string) {
  if (!playerId) return;
  try {
    await syncPlayerMonthPoints(playerId, date.slice(0, 7), [id]);
  } catch (err) {
    console.error("[loyalty] could not sync points for play log", id, err);
  }
}
