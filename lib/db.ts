import {
  Booking,
  BookingInput,
  BookingStatus,
  GRACE_MIN,
  LoggedVisitInput,
  PaymentStatus,
  StaffBookingInput,
  WalkInSessionInput,
  billableHours,
  makeReference,
  openHoursForDate,
  priceFor,
  slotStartsForDate,
} from "./booking";
import { getTableById, listTables } from "./tables";
import { audit } from "./ecosystem/store";
import { query, transaction } from "./pg";
import { timeToMinutes, toISODate } from "./utils";

/* ------------------------------------------------------------------
   Booking data layer — raw SQL against Postgres (see db/schema.sql).
   Bookings are per physical table (table_id). Consecutive sessions may
   sit flush against each other (GRACE_MIN = 0) — a 12:00–13:00 booking
   leaves 13:00 open for the next player. Turnover is a soft courtesy,
   not an enforced gap.
   ------------------------------------------------------------------ */

export const HAS_DB = !!process.env.DATABASE_URL;

/** minutes from midnight, shifting past-midnight labels into the same session day */
function sessionMinutes(startTime: string): number {
  const m = timeToMinutes(startTime);
  return m < 360 ? m + 1440 : m;
}

/** two intervals conflict if they actually overlap (touching end-to-start is
 *  fine); GRACE_MIN widens this only if the venue ever sets a non-zero buffer */
function graceConflict(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd + GRACE_MIN && bStart < aEnd + GRACE_MIN;
}

export interface BookedInterval {
  start: string; // "HH:MM"
  end: string; // "HH:MM" (may read 00:00–06:00 for past-midnight)
  startMin: number; // session minutes
  endMin: number;
}

export interface DayAvailability {
  date: string;
  table: { id: string; label: string; seats: number };
  open: string;
  close: string;
  openMin: number;
  closeMin: number;
  graceMin: number;
  slotStarts: string[];
  bookings: BookedInterval[];
}

interface BookingRow {
  id: string;
  reference: string;
  table_id: string;
  table_name: string;
  customer_name: string;
  phone: string;
  email: string | null;
  date: Date | string;
  start_time: string;
  duration_hrs: number;
  party_size: number;
  total_amount: number;
  status: Booking["status"];
  notes: string | null;
  player_id: string | null;
  origin: string | null;
  payment_status: string | null;
  checked_in_at: Date | string | null;
  checked_out_at: Date | string | null;
  created_at: Date | string;
}

function toISO(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    reference: r.reference,
    tableId: r.table_id,
    tableName: r.table_name,
    customerName: r.customer_name,
    phone: r.phone,
    email: r.email,
    date:
      r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10),
    startTime: r.start_time,
    durationHrs: Number(r.duration_hrs),
    partySize: Number(r.party_size),
    totalAmount: Number(r.total_amount),
    status: r.status,
    notes: r.notes,
    origin: (r.origin as Booking["origin"]) ?? "online",
    paymentStatus: (r.payment_status as PaymentStatus) ?? "unpaid",
    playerId: r.player_id ?? null,
    checkedInAt: toISO(r.checked_in_at),
    checkedOutAt: toISO(r.checked_out_at),
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

async function bookingsForDay(
  dateISO: string,
  tableId: string,
): Promise<Booking[]> {
  const rows = await query<BookingRow>(
    `SELECT * FROM bookings
     WHERE date = $1 AND table_id = $2 AND status <> 'CANCELLED'
     ORDER BY start_time`,
    [dateISO, tableId],
  );
  return rows.map(rowToBooking);
}

/**
 * The minutes a booking occupies its table. An open walk-in session (seated,
 * not yet closed) holds the table until it's closed — modelled as "until the
 * day's close" so nobody else can be booked onto it in the meantime.
 */
function toInterval(
  b: Booking,
  closeMin = Number.POSITIVE_INFINITY,
): readonly [number, number] {
  const s = sessionMinutes(b.startTime);
  if (b.checkedInAt && !b.checkedOutAt) {
    return [s, Math.max(s + 30, closeMin === Infinity ? s + 1440 : closeMin)] as const;
  }
  return [s, s + b.durationHrs * 60] as const;
}

/* ============================ Public API ============================ */

export async function getDayAvailability(
  dateISO: string,
  tableId: string,
): Promise<DayAvailability> {
  const table = await getTableById(tableId);
  if (!table) throw new UnknownTable();
  const { open, close } = openHoursForDate(dateISO);
  const closeM = timeToMinutes(close);
  const existing = await bookingsForDay(dateISO, tableId);

  const bookings: BookedInterval[] = existing
    .map((b) => {
      const [startMin, endMin] = toInterval(b, closeM);
      return {
        start: b.startTime,
        end: minutesToLabel(endMin),
        startMin,
        endMin,
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  return {
    date: dateISO,
    table: { id: table.id, label: table.label, seats: table.seats },
    open,
    close,
    openMin: timeToMinutes(open),
    closeMin: timeToMinutes(close),
    graceMin: GRACE_MIN,
    slotStarts: slotStartsForDate(dateISO),
    bookings,
  };
}

export interface TableDayAvailability {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  bookable: boolean;
  bookings: BookedInterval[];
}

export interface FloorAvailability {
  date: string;
  open: string;
  close: string;
  openMin: number;
  closeMin: number;
  graceMin: number;
  slotStarts: string[];
  tables: TableDayAvailability[];
}

/**
 * Availability for every active table on a single day, in one round-trip.
 * Powers the booking floor view — see all tables and their booked times at once.
 */
export async function getFloorAvailability(
  dateISO: string,
): Promise<FloorAvailability> {
  const [tables, rows] = await Promise.all([
    listTables(),
    query<BookingRow>(
      `SELECT * FROM bookings
       WHERE date = $1 AND status <> 'CANCELLED'
       ORDER BY start_time`,
      [dateISO],
    ),
  ]);

  const { open, close } = openHoursForDate(dateISO);
  const closeM = timeToMinutes(close);

  const byTable = new Map<string, BookedInterval[]>();
  for (const b of rows.map(rowToBooking)) {
    const [startMin, endMin] = toInterval(b, closeM);
    const list = byTable.get(b.tableId) ?? [];
    list.push({ start: b.startTime, end: minutesToLabel(endMin), startMin, endMin });
    byTable.set(b.tableId, list);
  }

  return {
    date: dateISO,
    open,
    close,
    openMin: timeToMinutes(open),
    closeMin: timeToMinutes(close),
    graceMin: GRACE_MIN,
    slotStarts: slotStartsForDate(dateISO),
    tables: tables.map((t) => ({
      id: t.id,
      label: t.label,
      area: t.area,
      note: t.note,
      seats: t.seats,
      bookable: t.bookable,
      bookings: (byTable.get(t.id) ?? []).sort((a, b) => a.startMin - b.startMin),
    })),
  };
}

function minutesToLabel(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function isRangeAvailable(
  dateISO: string,
  tableId: string,
  startTime: string,
  durationHrs: number,
): Promise<boolean> {
  const existing = await bookingsForDay(dateISO, tableId);
  const closeM = timeToMinutes(openHoursForDate(dateISO).close);
  const s = sessionMinutes(startTime);
  const e = s + durationHrs * 60;
  for (const b of existing) {
    const [bs, be] = toInterval(b, closeM);
    if (graceConflict(s, e, bs, be)) return false;
  }
  return true;
}

/** Is this table free to seat someone right now (no in-progress booking or
 *  open session)? Used when staff start a walk-in session. */
export async function isTableFreeNow(tableId: string): Promise<boolean> {
  const now = new Date();
  const date = toISODate(now);
  const rows = await query<BookingRow>(
    `SELECT * FROM bookings
     WHERE table_id = $1 AND date = $2
       AND status <> 'CANCELLED' AND checked_out_at IS NULL`,
    [tableId, date],
  );
  let nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < 360) nowMin += 1440;
  for (const b of rows.map(rowToBooking)) {
    if (b.checkedInAt) return false; // an open session — table is occupied
    const s = sessionMinutes(b.startTime);
    const e = s + b.durationHrs * 60;
    if (nowMin >= s && nowMin < e) return false; // a booking is in progress
  }
  return true;
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  const table = await getTableById(input.tableId);
  if (!table) throw new UnknownTable();
  if (!table.bookable) throw new TableNotBookable();
  const total = priceFor(input.durationHrs);
  const booking: Booking = {
    id: crypto.randomUUID(),
    reference: makeReference(),
    tableId: table.id,
    tableName: table.label,
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    date: input.date,
    startTime: input.startTime,
    durationHrs: input.durationHrs,
    partySize: input.partySize,
    totalAmount: total,
    status: "CONFIRMED",
    notes: input.notes?.trim() || null,
    origin: "online",
    paymentStatus: "unpaid",
    playerId: null,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date().toISOString(),
  };

  await transaction(async (client) => {
    // serialise concurrent bookings for the same date + table
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.date}|${table.id}`,
    ]);
    const ok = await isRangeAvailable(
      input.date,
      table.id,
      input.startTime,
      input.durationHrs,
    );
    if (!ok) throw new BookingConflict();
    await client.query(
      `INSERT INTO bookings
        (id, reference, table_id, table_name, customer_name, phone, email,
         date, start_time, duration_hrs, party_size, total_amount, status, notes,
         player_id, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'online')`,
      [
        booking.id,
        booking.reference,
        booking.tableId,
        booking.tableName,
        booking.customerName,
        booking.phone,
        booking.email,
        booking.date,
        booking.startTime,
        booking.durationHrs,
        booking.partySize,
        booking.totalAmount,
        booking.status,
        booking.notes,
        input.playerId ?? null,
      ],
    );
  });

  return { ...booking, playerId: input.playerId ?? null };
}

export async function listBookings(
  opts: {
    date?: string;
    status?: BookingStatus;
    open?: boolean;
    limit?: number;
  } = {},
): Promise<Booking[]> {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (opts.date) {
    vals.push(opts.date);
    where.push(`date = $${vals.length}`);
  }
  if (opts.status) {
    vals.push(opts.status);
    where.push(`status = $${vals.length}`);
  }
  if (opts.open) where.push(`checked_in_at IS NOT NULL AND checked_out_at IS NULL`);
  vals.push(opts.limit ?? 300);
  const rows = await query<BookingRow>(
    `SELECT * FROM bookings
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY date DESC, start_time DESC
     LIMIT $${vals.length}`,
    vals,
  );
  return rows.map(rowToBooking);
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const rows = await query<BookingRow>(`SELECT * FROM bookings WHERE id = $1`, [
    id,
  ]);
  return rows[0] ? rowToBooking(rows[0]) : null;
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Staff books a fixed slot for a customer. Skips the online lead-time /
 *  past-slot guard, still refuses a real clash on the table. */
export async function createStaffBooking(
  input: StaffBookingInput,
  actor: string,
): Promise<Booking> {
  const table = await getTableById(input.tableId);
  if (!table) throw new UnknownTable();
  const id = crypto.randomUUID();
  const reference = makeReference();
  const total = priceFor(input.durationHrs);
  const origin = input.origin ?? "staff";

  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.date}|${table.id}`,
    ]);
    if (!(await isRangeAvailable(input.date, table.id, input.startTime, input.durationHrs)))
      throw new BookingConflict();
    await client.query(
      `INSERT INTO bookings
        (id, reference, table_id, table_name, customer_name, phone, email,
         date, start_time, duration_hrs, party_size, total_amount, status, notes,
         player_id, origin, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'CONFIRMED',$13,$14,$15,'unpaid')`,
      [
        id,
        reference,
        table.id,
        table.label,
        input.customerName.trim(),
        (input.phone ?? "").trim(),
        input.email?.trim() || null,
        input.date,
        input.startTime,
        input.durationHrs,
        input.partySize,
        total,
        input.notes?.trim() || null,
        input.playerId ?? null,
        origin,
      ],
    );
  });
  await audit(
    actor,
    "booking.create",
    "booking",
    id,
    `${table.label} ${input.date} ${input.startTime} ${input.durationHrs}h · ${origin}`,
  );
  return (await getBookingById(id))!;
}

/** Staff seats a walk-in right now. Open-ended: close it on departure with
 *  {@link closeSession} to compute the charge. */
export async function startWalkInSession(
  input: WalkInSessionInput,
  actor: string,
): Promise<Booking> {
  const table = await getTableById(input.tableId);
  if (!table) throw new UnknownTable();
  const now = new Date();
  const date = toISODate(now);
  const startTime = hhmm(now);
  const id = crypto.randomUUID();
  const reference = makeReference();

  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${date}|${table.id}`,
    ]);
    if (!(await isTableFreeNow(table.id))) throw new BookingConflict();
    await client.query(
      `INSERT INTO bookings
        (id, reference, table_id, table_name, customer_name, phone, email,
         date, start_time, duration_hrs, party_size, total_amount, status, notes,
         player_id, origin, payment_status, checked_in_at)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,0.5,$9,0,'CONFIRMED',$10,$11,'walk_in','unpaid', now())`,
      [
        id,
        reference,
        table.id,
        table.label,
        input.customerName.trim(),
        (input.phone ?? "").trim(),
        date,
        startTime,
        input.partySize,
        input.notes?.trim() || null,
        input.playerId ?? null,
      ],
    );
  });
  await audit(
    actor,
    "booking.session.start",
    "booking",
    id,
    `${table.label} · walk-in · ${input.customerName.trim()}`,
  );
  return (await getBookingById(id))!;
}

export class NotOpenSession extends Error {
  constructor() {
    super("That booking isn't an open session.");
    this.name = "NotOpenSession";
  }
}

export class BadTimeRange extends Error {
  constructor() {
    super("The leaving time must be after the start time.");
    this.name = "BadTimeRange";
  }
}

/**
 * Staff logs a walk-in that already finished: enter the table, who it was,
 * when they started and left, and what to charge. Stored as a closed session
 * (both check-in and check-out set). No conflict check — it's history.
 */
export async function logCompletedVisit(
  input: LoggedVisitInput,
  actor: string,
): Promise<Booking> {
  const table = await getTableById(input.tableId);
  if (!table) throw new UnknownTable();
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (!(end.getTime() > start.getTime())) throw new BadTimeRange();

  const mins = (end.getTime() - start.getTime()) / 60000;
  const hrs = billableHours(mins);
  const total =
    input.amount != null && Number.isFinite(input.amount)
      ? Math.max(0, Math.round(input.amount))
      : priceFor(hrs);
  const id = crypto.randomUUID();
  const reference = makeReference();

  await query(
    `INSERT INTO bookings
       (id, reference, table_id, table_name, customer_name, phone, email,
        date, start_time, duration_hrs, party_size, total_amount, status, notes,
        player_id, origin, payment_status, checked_in_at, checked_out_at)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,'CONFIRMED',$12,$13,'staff',$14,$15,$16)`,
    [
      id,
      reference,
      table.id,
      table.label,
      input.customerName.trim(),
      (input.phone ?? "").trim(),
      toISODate(start),
      hhmm(start),
      hrs,
      input.partySize,
      total,
      input.notes?.trim() || null,
      input.playerId ?? null,
      input.paid ? "paid" : "unpaid",
      start.toISOString(),
      end.toISOString(),
    ],
  );
  await audit(
    actor,
    "booking.visit.log",
    "booking",
    id,
    `${table.label} · ${input.customerName.trim()} · ${hrs}h · LKR ${total} · ${
      input.paid ? "paid" : "unpaid"
    }`,
  );
  return (await getBookingById(id))!;
}

/** Close an open walk-in session: record the leaving time, bill the minutes
 *  played (rounded up to 30-min blocks) and mark payment. */
export async function closeSession(
  id: string,
  opts: {
    checkedOutAt?: string;
    totalAmount?: number;
    paymentStatus?: PaymentStatus;
  },
  actor: string,
): Promise<Booking> {
  const b = await getBookingById(id);
  if (!b) throw new UnknownTable();
  if (!b.checkedInAt || b.checkedOutAt) throw new NotOpenSession();

  const start = new Date(b.checkedInAt);
  const end = opts.checkedOutAt ? new Date(opts.checkedOutAt) : new Date();
  const mins = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  const hrs = billableHours(mins);
  const total =
    opts.totalAmount != null && Number.isFinite(opts.totalAmount)
      ? Math.max(0, Math.round(opts.totalAmount))
      : priceFor(hrs);
  const pay: PaymentStatus = opts.paymentStatus ?? "paid";

  await query(
    `UPDATE bookings
     SET duration_hrs = $2, total_amount = $3, checked_out_at = $4,
         payment_status = $5, status = 'CONFIRMED'
     WHERE id = $1`,
    [id, hrs, total, end.toISOString(), pay],
  );
  await audit(
    actor,
    "booking.session.close",
    "booking",
    id,
    `${hrs}h · LKR ${total} · ${pay}`,
  );
  return (await getBookingById(id))!;
}

/**
 * Overstay: a customer booked N hours but played longer. Adds `addHours` to
 * the booking's length and its charge (`priceFor(addHours)` on top of the
 * existing total). Not blocked by a later booking on the table — this records
 * what was actually played.
 */
export async function extendBooking(
  id: string,
  addHours: number,
  opts: { paymentStatus?: PaymentStatus } = {},
  actor: string = "staff",
): Promise<Booking> {
  const b = await getBookingById(id);
  if (!b) throw new UnknownTable();
  if (b.status === "CANCELLED") throw new NotOpenSession();
  const add = Math.round(addHours * 2) / 2; // snap to 30-min
  if (!(add > 0)) throw new NotOpenSession();

  const newDuration = +(b.durationHrs + add).toFixed(1);
  const newTotal = b.totalAmount + priceFor(add);
  await query(
    `UPDATE bookings
     SET duration_hrs = $2, total_amount = $3
         ${opts.paymentStatus ? ", payment_status = $4" : ""}
     WHERE id = $1`,
    opts.paymentStatus
      ? [id, newDuration, newTotal, opts.paymentStatus]
      : [id, newDuration, newTotal],
  );
  await audit(
    actor,
    "booking.extend",
    "booking",
    id,
    `+${add}h → ${newDuration}h · +LKR ${priceFor(add)} → LKR ${newTotal}`,
  );
  return (await getBookingById(id))!;
}

export async function cancelBooking(
  id: string,
  actor: string,
): Promise<Booking | null> {
  await query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [id]);
  await audit(actor, "booking.cancel", "booking", id, "");
  return getBookingById(id);
}

export async function deleteBooking(id: string, actor: string): Promise<void> {
  await query(`DELETE FROM bookings WHERE id = $1`, [id]);
  await audit(actor, "booking.delete", "booking", id, "");
}

export async function setBookingPayment(
  id: string,
  status: PaymentStatus,
  actor: string,
): Promise<Booking | null> {
  await query(`UPDATE bookings SET payment_status = $2 WHERE id = $1`, [
    id,
    status,
  ]);
  await audit(actor, "booking.payment", "booking", id, status);
  return getBookingById(id);
}

export class BookingConflict extends Error {
  constructor() {
    super("That time clashes with another booking on this table.");
    this.name = "BookingConflict";
  }
}

export class UnknownTable extends Error {
  constructor() {
    super("That table isn't on the floor any more.");
    this.name = "UnknownTable";
  }
}

export class TableNotBookable extends Error {
  constructor() {
    super("This table can't be reserved online — please call us to book it.");
    this.name = "TableNotBookable";
  }
}
