import { audit, rid } from "./ecosystem/store";
import { query } from "./pg";
import { ENTRY_KINDS, type EntryKind } from "./accounts-categories";

/* ------------------------------------------------------------------
   Accounting — raw SQL against Postgres (see db/schema.sql).

   One ledger (`acct_entries`) holds every rupee that moves through the
   cash box or the bank: table play, snacks and drinks, expenses, bank
   deposits, investor capital. Balances, the P&L, cash flow and balance
   sheet are all sums over it. The daily cash box (`cash_days`) records
   the counted opening and closing float so it can be checked against
   what the ledger says should be there.
   ------------------------------------------------------------------ */

const TZ = "Asia/Colombo";

/** Today's date in Sri Lanka, YYYY-MM-DD. */
export function todayLK(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

const int = (v: unknown): number => Math.trunc(Number(v) || 0);
const iso = (v: Date | string): string =>
  v instanceof Date ? v.toISOString() : String(v);

/** Signed effect of a row on each account, in SQL (mirrors entryEffect). */
const CASH_DELTA = `CASE WHEN kind IN ('opening','income','capital','withdrawal') THEN cash ELSE -cash END`;
const BANK_DELTA = `CASE WHEN kind IN ('opening','income','capital','deposit') THEN bank ELSE -bank END`;

export interface Balances {
  cash: number;
  bank: number;
}

/* ------------------------------- investors ------------------------------- */

export interface Partner {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  username: string | null;
  positions: string[];
  sharePct: number;
  canEditAccounts: boolean;
  hasLogin: boolean;
  hasSignature: boolean;
}

interface PartnerRow {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  username: string | null;
  password_hash: string | null;
  positions: string[] | null;
  share_pct: number;
  can_edit_accounts: boolean;
  has_signature: boolean;
}
const toPartner = (r: PartnerRow): Partner => ({
  id: r.id,
  name: r.name,
  active: r.active,
  sortOrder: Number(r.sort_order),
  username: r.username ?? null,
  positions: r.positions ?? [],
  sharePct: int(r.share_pct),
  canEditAccounts: !!r.can_edit_accounts,
  hasLogin: !!r.username && !!r.password_hash,
  hasSignature: !!r.has_signature,
});

export async function listPartners(): Promise<Partner[]> {
  const rows = await query<PartnerRow>(
    `SELECT id, name, active, sort_order, username, password_hash, positions, share_pct,
            can_edit_accounts, (signature_image IS NOT NULL) AS has_signature
       FROM business_partners ORDER BY sort_order, created_at`,
  );
  return rows.map(toPartner);
}

export async function updatePartner(
  id: string,
  patch: {
    name?: string;
    active?: boolean;
    sharePct?: number;
    canEditAccounts?: boolean;
  },
  actor: string,
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (patch.name !== undefined && patch.name.trim()) set("name", patch.name.trim());
  if (patch.active !== undefined) set("active", !!patch.active);
  if (patch.sharePct !== undefined)
    set("share_pct", Math.min(100, Math.max(0, Math.round(patch.sharePct))));
  if (patch.canEditAccounts !== undefined)
    set("can_edit_accounts", !!patch.canEditAccounts);
  if (!sets.length) return;
  vals.push(id);
  await query(
    `UPDATE business_partners SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals,
  );
  await audit(actor, "accounts.investor.update", "partner", id, sets.join(", "));
}

/* -------------------------------- entries -------------------------------- */

export interface Entry {
  id: string;
  date: string;
  kind: EntryKind;
  category: string;
  description: string;
  tableId: string | null;
  tableName: string | null;
  startTime: string | null;
  endTime: string | null;
  minutes: number | null;
  partnerId: string | null;
  partnerName: string | null;
  cash: number;
  bank: number;
  hasReceipt: boolean;
  createdBy: string;
  createdAt: string;
}

interface EntryRow {
  id: string;
  date: string;
  kind: EntryKind;
  category: string;
  description: string;
  table_id: string | null;
  table_name: string | null;
  start_time: string | null;
  end_time: string | null;
  minutes: number | null;
  partner_id: string | null;
  partner_name: string | null;
  cash: string | number;
  bank: string | number;
  has_receipt: boolean;
  created_by: string;
  created_at: Date | string;
}
const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  date: String(r.date).slice(0, 10),
  kind: r.kind,
  category: r.category,
  description: r.description,
  tableId: r.table_id,
  tableName: r.table_name,
  startTime: r.start_time,
  endTime: r.end_time,
  minutes: r.minutes == null ? null : int(r.minutes),
  partnerId: r.partner_id,
  partnerName: r.partner_name,
  cash: int(r.cash),
  bank: int(r.bank),
  hasReceipt: !!r.has_receipt,
  createdBy: r.created_by,
  createdAt: iso(r.created_at),
});

const ENTRY_SELECT = `
  SELECT e.id, e.date, e.kind, e.category, e.description, e.table_id, e.table_name,
         e.start_time, e.end_time, e.minutes, e.partner_id, p.name AS partner_name,
         e.cash, e.bank, (e.receipt_image IS NOT NULL) AS has_receipt,
         e.created_by, e.created_at
    FROM acct_entries e
    LEFT JOIN business_partners p ON p.id = e.partner_id`;

export async function listEntries(
  opts: { from?: string; to?: string; kind?: EntryKind; limit?: number } = {},
): Promise<Entry[]> {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (opts.from) {
    vals.push(opts.from);
    where.push(`e.date >= $${vals.length}`);
  }
  if (opts.to) {
    vals.push(opts.to);
    where.push(`e.date <= $${vals.length}`);
  }
  if (opts.kind) {
    vals.push(opts.kind);
    where.push(`e.kind = $${vals.length}`);
  }
  vals.push(Math.min(50000, Math.max(1, opts.limit ?? 2000)));
  const rows = await query<EntryRow>(
    `${ENTRY_SELECT}
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY e.date DESC, e.created_at DESC
     LIMIT $${vals.length}`,
    vals,
  );
  return rows.map(toEntry);
}

export class AccountsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountsError";
  }
}

/* ------------------------------ change log ----------------------------- */

/** The parts of an entry worth showing in the change log. */
type Snapshot = Pick<
  Entry,
  "date" | "kind" | "category" | "description" | "tableName" | "startTime" | "endTime" | "partnerName" | "cash" | "bank"
>;
const snap = (e: Entry): Snapshot => ({
  date: e.date,
  kind: e.kind,
  category: e.category,
  description: e.description,
  tableName: e.tableName,
  startTime: e.startTime,
  endTime: e.endTime,
  partnerName: e.partnerName,
  cash: e.cash,
  bank: e.bank,
});

async function logChange(
  entryId: string,
  action: "create" | "edit" | "delete",
  actor: string,
  before: Entry | null,
  after: Entry | null,
): Promise<void> {
  await query(
    `INSERT INTO acct_entry_log (entry_id, action, actor, before, after) VALUES ($1,$2,$3,$4,$5)`,
    [
      entryId,
      action,
      actor,
      before ? JSON.stringify(snap(before)) : null,
      after ? JSON.stringify(snap(after)) : null,
    ],
  );
}

export interface LogLine {
  id: number;
  entryId: string;
  action: "create" | "edit" | "delete";
  actor: string;
  at: string;
  before: Snapshot | null;
  after: Snapshot | null;
}

export async function listLog(limit = 300): Promise<LogLine[]> {
  const rows = await query<{
    id: string;
    entry_id: string;
    action: LogLine["action"];
    actor: string;
    at: Date | string;
    before: Snapshot | null;
    after: Snapshot | null;
  }>(`SELECT * FROM acct_entry_log ORDER BY at DESC, id DESC LIMIT $1`, [limit]);
  return rows.map((r) => ({
    id: Number(r.id),
    entryId: r.entry_id,
    action: r.action,
    actor: r.actor,
    at: iso(r.at),
    before: r.before,
    after: r.after,
  }));
}

export interface EntryInput {
  date: string;
  kind: EntryKind;
  category?: string;
  description?: string;
  tableId?: string | null;
  tableName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  minutes?: number | null;
  partnerId?: string | null;
  cash?: number;
  bank?: number;
  receiptImage?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function clean(input: EntryInput) {
  if (!DATE_RE.test(input.date)) throw new AccountsError("Pick a valid date");
  if (!(ENTRY_KINDS as readonly string[]).includes(input.kind))
    throw new AccountsError("Unknown entry type");
  // the books run up to today; a future date would show in balances before it happens
  if (input.date > todayLK()) throw new AccountsError("Entries can't be dated in the future");
  if ((input.kind === "capital" || input.kind === "drawing") && !input.partnerId)
    throw new AccountsError("Pick the investor");
  let cash = Math.max(0, int(input.cash));
  let bank = Math.max(0, int(input.bank));
  // transfers move one amount between the two accounts
  if (input.kind === "deposit" || input.kind === "withdrawal") {
    const amount = Math.max(cash, bank);
    cash = bank = amount;
  }
  if (cash + bank <= 0) throw new AccountsError("Enter an amount");
  const category = (input.category ?? "").trim().slice(0, 80);
  if ((input.kind === "income" || input.kind === "expense") && !category)
    throw new AccountsError("Pick a category");
  const time = (t?: string | null) => (t && TIME_RE.test(t) ? t : null);
  return {
    date: input.date,
    kind: input.kind,
    category,
    description: (input.description ?? "").trim().slice(0, 300),
    tableId: input.tableId || null,
    tableName: input.tableName ? String(input.tableName).slice(0, 60) : null,
    startTime: time(input.startTime),
    endTime: time(input.endTime),
    minutes:
      input.minutes == null || !Number.isFinite(Number(input.minutes))
        ? null
        : Math.max(0, int(input.minutes)),
    partnerId: input.partnerId || null,
    cash,
    bank,
  };
}

export async function addEntry(input: EntryInput, actor: string): Promise<Entry> {
  const e = clean(input);
  const id = "ae_" + rid().slice(0, 12);
  await query(
    `INSERT INTO acct_entries
       (id, date, kind, category, description, table_id, table_name, start_time,
        end_time, minutes, partner_id, cash, bank, receipt_image, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      e.date,
      e.kind,
      e.category,
      e.description,
      e.tableId,
      e.tableName,
      e.startTime,
      e.endTime,
      e.minutes,
      e.partnerId,
      e.cash,
      e.bank,
      input.receiptImage || null,
      actor,
    ],
  );
  await audit(
    actor,
    `accounts.${e.kind}.add`,
    "acct_entry",
    id,
    `${e.date} · ${e.category || e.kind} · cash ${e.cash} · bank ${e.bank}`,
  );
  const rows = await query<EntryRow>(`${ENTRY_SELECT} WHERE e.id = $1`, [id]);
  const created = toEntry(rows[0]);
  await logChange(id, "create", actor, null, created);
  return created;
}

/** Correct an entry in place (same kind). Fields left out keep their value. */
export async function updateEntry(
  id: string,
  patch: Partial<Omit<EntryInput, "kind" | "receiptImage">>,
  actor: string,
): Promise<Entry> {
  const rows = await query<EntryRow>(`${ENTRY_SELECT} WHERE e.id = $1`, [id]);
  if (!rows[0]) throw new AccountsError("Entry not found");
  const cur = toEntry(rows[0]);
  const e = clean({
    date: patch.date ?? cur.date,
    kind: cur.kind,
    category: patch.category ?? cur.category,
    description: patch.description ?? cur.description,
    tableId: patch.tableId !== undefined ? patch.tableId : cur.tableId,
    tableName: patch.tableName !== undefined ? patch.tableName : cur.tableName,
    startTime: patch.startTime !== undefined ? patch.startTime : cur.startTime,
    endTime: patch.endTime !== undefined ? patch.endTime : cur.endTime,
    minutes: patch.minutes !== undefined ? patch.minutes : cur.minutes,
    partnerId: patch.partnerId !== undefined ? patch.partnerId : cur.partnerId,
    cash: patch.cash ?? cur.cash,
    bank: patch.bank ?? cur.bank,
  });
  await query(
    `UPDATE acct_entries SET date=$2, category=$3, description=$4, table_id=$5,
            table_name=$6, start_time=$7, end_time=$8, minutes=$9, partner_id=$10,
            cash=$11, bank=$12
      WHERE id = $1`,
    [
      id,
      e.date,
      e.category,
      e.description,
      e.tableId,
      e.tableName,
      e.startTime,
      e.endTime,
      e.minutes,
      e.partnerId,
      e.cash,
      e.bank,
    ],
  );
  await audit(
    actor,
    `accounts.${cur.kind}.edit`,
    "acct_entry",
    id,
    `cash ${cur.cash}→${e.cash} · bank ${cur.bank}→${e.bank}`,
  );
  const after = toEntry((await query<EntryRow>(`${ENTRY_SELECT} WHERE e.id = $1`, [id]))[0]);
  if (JSON.stringify(snap(cur)) !== JSON.stringify(snap(after)))
    await logChange(id, "edit", actor, cur, after);
  return after;
}

export async function deleteEntry(id: string, actor: string): Promise<void> {
  const before = await query<EntryRow>(`${ENTRY_SELECT} WHERE e.id = $1`, [id]);
  if (before[0]) await logChange(id, "delete", actor, toEntry(before[0]), null);
  const rows = await query<{ kind: string; date: string; cash: string; bank: string }>(
    `DELETE FROM acct_entries WHERE id = $1 RETURNING kind, date, cash, bank`,
    [id],
  );
  if (rows[0])
    await audit(
      actor,
      `accounts.${rows[0].kind}.delete`,
      "acct_entry",
      id,
      `${rows[0].date} · cash ${rows[0].cash} · bank ${rows[0].bank}`,
    );
}

export async function getEntryReceipt(id: string): Promise<string | null> {
  const rows = await query<{ receipt_image: string | null }>(
    `SELECT receipt_image FROM acct_entries WHERE id = $1`,
    [id],
  );
  return rows[0]?.receipt_image ?? null;
}

/* ------------------------------- balances ------------------------------- */

/** Cash + bank balances from every entry dated on or before `upto` (or all). */
export async function balances(opts: { upto?: string; before?: string } = {}): Promise<Balances> {
  const vals: unknown[] = [];
  let where = "";
  if (opts.upto) {
    vals.push(opts.upto);
    where = `WHERE date <= $1`;
  } else if (opts.before) {
    vals.push(opts.before);
    where = `WHERE date < $1`;
  }
  const rows = await query<{ cash: string; bank: string }>(
    `SELECT COALESCE(SUM(${CASH_DELTA}),0) AS cash, COALESCE(SUM(${BANK_DELTA}),0) AS bank
       FROM acct_entries ${where}`,
    vals,
  );
  return { cash: int(rows[0]?.cash), bank: int(rows[0]?.bank) };
}

/* ------------------------------- cash box ------------------------------- */

export interface CashDay {
  date: string;
  opening: number | null;
  closing: number | null;
  openingNote: string;
  closingNote: string;
  openedBy: string | null;
  closedBy: string | null;
}

interface CashRow {
  date: string;
  opening_amount: string | number | null;
  closing_amount: string | number | null;
  opening_note: string;
  closing_note: string;
  opened_by: string | null;
  closed_by: string | null;
}
const toCashDay = (r: CashRow): CashDay => ({
  date: String(r.date).slice(0, 10),
  opening: r.opening_amount == null ? null : int(r.opening_amount),
  closing: r.closing_amount == null ? null : int(r.closing_amount),
  openingNote: r.opening_note,
  closingNote: r.closing_note,
  openedBy: r.opened_by,
  closedBy: r.closed_by,
});

export async function getCashDay(date: string): Promise<CashDay | null> {
  const rows = await query<CashRow>(`SELECT * FROM cash_days WHERE date = $1`, [date]);
  return rows[0] ? toCashDay(rows[0]) : null;
}

/** The most recent counted close before `date` — today's suggested opening float. */
export async function previousClose(date: string): Promise<CashDay | null> {
  const rows = await query<CashRow>(
    `SELECT * FROM cash_days WHERE date < $1 AND closing_amount IS NOT NULL
      ORDER BY date DESC LIMIT 1`,
    [date],
  );
  return rows[0] ? toCashDay(rows[0]) : null;
}

export async function setCashBox(
  input: { date: string; phase: "open" | "close"; amount: number | null; note?: string },
  actor: string,
): Promise<CashDay> {
  if (!DATE_RE.test(input.date)) throw new AccountsError("Pick a valid date");
  if (input.date > todayLK()) throw new AccountsError("You can't close a day that hasn't happened yet");
  const amount = input.amount == null ? null : Math.max(0, int(input.amount));
  const note = (input.note ?? "").trim().slice(0, 200);
  const [amt, noteCol, by, at] =
    input.phase === "open"
      ? ["opening_amount", "opening_note", "opened_by", "opened_at"]
      : ["closing_amount", "closing_note", "closed_by", "closed_at"];
  await query(
    `INSERT INTO cash_days (date, ${amt}, ${noteCol}, ${by}, ${at})
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (date) DO UPDATE SET
       ${amt} = EXCLUDED.${amt}, ${noteCol} = EXCLUDED.${noteCol},
       ${by} = EXCLUDED.${by}, ${at} = now()`,
    [input.date, amount, note, actor],
  );
  await audit(
    actor,
    `accounts.cashbox.${input.phase}`,
    "cash_day",
    input.date,
    amount == null ? "cleared" : `LKR ${amount}`,
  );
  return (await getCashDay(input.date))!;
}

/* ------------------------------- day book ------------------------------- */

export interface StaffLogLine {
  id: string;
  tableId: string;
  tableName: string;
  startTime: string;
  endTime: string;
  billedMin: number;
  amount: number;
  customer: string;
}

/**
 * The cash box opening float. Nobody types it: it is the previous counted
 * close carried forward (plus any cash movement on days nobody closed in
 * between), or on the very first day the starting cash balance.
 */
export interface CashOpening {
  amount: number;
  source: "close" | "start";
  closeDate: string | null; // the close it was carried from
  gap: boolean; // true when that close wasn't the day before
}

export interface DayBook {
  date: string;
  entries: Entry[];
  cashDay: CashDay | null;
  previousClose: CashDay | null;
  cashOpening: CashOpening;
  start: Balances; // ledger balances before this day
  end: Balances; // after this day
  staffLog: StaffLogLine[]; // the staff daily play log, for cross-checking
}

export async function dayBook(date: string): Promise<DayBook> {
  if (!DATE_RE.test(date)) throw new AccountsError("Pick a valid date");
  const [entries, cashDay, prev, start, end, logs] = await Promise.all([
    listEntries({ from: date, to: date }),
    getCashDay(date),
    previousClose(date),
    balances({ before: date }),
    balances({ upto: date }),
    query<{
      id: string;
      table_id: string;
      table_name: string;
      start_time: string;
      end_time: string;
      billed_min: number;
      amount: number;
      customer: string | null;
    }>(
      `SELECT l.id, l.table_id, l.table_name, l.start_time, l.end_time, l.billed_min,
              l.amount, COALESCE(p.full_name, l.customer_name) AS customer
         FROM play_logs l LEFT JOIN player_profiles p ON p.id = l.player_id
        WHERE l.date = $1 ORDER BY l.table_name, l.start_time`,
      [date],
    ).catch(() => []),
  ]);
  let cashOpening: CashOpening;
  if (prev) {
    // cash that moved on unclosed days between that close and today
    const atClose = await balances({ upto: prev.date });
    const dayBefore = new Date(Date.parse(date + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
    cashOpening = {
      amount: (prev.closing ?? 0) + (start.cash - atClose.cash),
      source: "close",
      closeDate: prev.date,
      gap: prev.date !== dayBefore,
    };
  } else {
    // first day in the books: the starting cash recorded that day
    const openingCash = entries.filter((e) => e.kind === "opening").reduce((s, e) => s + e.cash, 0);
    cashOpening = { amount: start.cash + openingCash, source: "start", closeDate: null, gap: false };
  }
  return {
    date,
    entries: entries.reverse(), // oldest first reads like a day book
    cashDay,
    previousClose: prev,
    cashOpening,
    start,
    end,
    staffLog: logs.map((l) => ({
      id: l.id,
      tableId: l.table_id,
      tableName: l.table_name,
      startTime: l.start_time,
      endTime: l.end_time,
      billedMin: int(l.billed_min),
      amount: int(l.amount),
      customer: l.customer ?? "",
    })),
  };
}

/* ------------------------------- overview ------------------------------- */

export interface DayTotals {
  date: string;
  income: number;
  expense: number;
}

export interface Overview {
  today: string;
  balances: Balances;
  todayTotals: { income: number; incomeCash: number; incomeBank: number; expense: number };
  month: { from: string; income: number; expense: number };
  daily: DayTotals[]; // last 14 days, oldest first
  capitalByPartner: Record<string, number>;
  drawingsByPartner: Record<string, number>;
  recent: Entry[];
  lastClose: CashDay | null;
  startDate: string | null; // earliest entry
}

export async function overview(today = todayLK()): Promise<Overview> {
  const monthStart = today.slice(0, 8) + "01";
  const [bal, todayRow, monthRow, daily, partnerRows, recent, lastClose, first] =
    await Promise.all([
      balances(),
      query<{ income: string; ic: string; ib: string; expense: string }>(
        `SELECT COALESCE(SUM(cash+bank) FILTER (WHERE kind='income'),0) AS income,
                COALESCE(SUM(cash) FILTER (WHERE kind='income'),0) AS ic,
                COALESCE(SUM(bank) FILTER (WHERE kind='income'),0) AS ib,
                COALESCE(SUM(cash+bank) FILTER (WHERE kind='expense'),0) AS expense
           FROM acct_entries WHERE date = $1`,
        [today],
      ),
      query<{ income: string; expense: string }>(
        `SELECT COALESCE(SUM(cash+bank) FILTER (WHERE kind='income'),0) AS income,
                COALESCE(SUM(cash+bank) FILTER (WHERE kind='expense'),0) AS expense
           FROM acct_entries WHERE date BETWEEN $1 AND $2`,
        [monthStart, today],
      ),
      query<{ d: string; income: string; expense: string }>(
        `SELECT g.d::date::text AS d,
                COALESCE(SUM(e.cash+e.bank) FILTER (WHERE e.kind='income'),0) AS income,
                COALESCE(SUM(e.cash+e.bank) FILTER (WHERE e.kind='expense'),0) AS expense
           FROM generate_series($1::date - 13, $1::date, '1 day') AS g(d)
           LEFT JOIN acct_entries e ON e.date = g.d::date
          GROUP BY g.d ORDER BY g.d`,
        [today],
      ),
      query<{ partner_id: string; kind: string; total: string }>(
        `SELECT partner_id, kind, SUM(cash+bank) AS total FROM acct_entries
          WHERE kind IN ('capital','drawing') AND partner_id IS NOT NULL
          GROUP BY partner_id, kind`,
      ),
      query<EntryRow>(`${ENTRY_SELECT} ORDER BY e.date DESC, e.created_at DESC LIMIT 8`),
      query<CashRow>(
        `SELECT * FROM cash_days WHERE closing_amount IS NOT NULL ORDER BY date DESC LIMIT 1`,
      ),
      query<{ d: string | null }>(`SELECT MIN(date)::text AS d FROM acct_entries`),
    ]);
  const capitalByPartner: Record<string, number> = {};
  const drawingsByPartner: Record<string, number> = {};
  for (const r of partnerRows)
    (r.kind === "capital" ? capitalByPartner : drawingsByPartner)[r.partner_id] = int(r.total);
  return {
    today,
    balances: bal,
    todayTotals: {
      income: int(todayRow[0]?.income),
      incomeCash: int(todayRow[0]?.ic),
      incomeBank: int(todayRow[0]?.ib),
      expense: int(todayRow[0]?.expense),
    },
    month: {
      from: monthStart,
      income: int(monthRow[0]?.income),
      expense: int(monthRow[0]?.expense),
    },
    daily: daily.map((r) => ({
      date: r.d,
      income: int(r.income),
      expense: int(r.expense),
    })),
    capitalByPartner,
    drawingsByPartner,
    recent: recent.map(toEntry),
    lastClose: lastClose[0] ? toCashDay(lastClose[0]) : null,
    startDate: first[0]?.d ?? null,
  };
}

/* -------------------------------- reports ------------------------------- */

export interface ReportLine {
  kind: EntryKind;
  category: string;
  tableName: string | null;
  partnerId: string | null;
  cash: number;
  bank: number;
  count: number;
}

export interface ReportData {
  from: string;
  to: string;
  opening: Balances; // before `from`
  closing: Balances; // at end of `to`
  period: ReportLine[]; // entries from..to, grouped
  cumulative: ReportLine[]; // every entry up to `to`, grouped (balance sheet)
}

async function grouped(where: string, vals: unknown[]): Promise<ReportLine[]> {
  const rows = await query<{
    kind: EntryKind;
    category: string;
    table_name: string | null;
    partner_id: string | null;
    cash: string;
    bank: string;
    n: string;
  }>(
    `SELECT kind, category, table_name, partner_id,
            SUM(cash) AS cash, SUM(bank) AS bank, COUNT(*) AS n
       FROM acct_entries WHERE ${where}
      GROUP BY kind, category, table_name, partner_id
      ORDER BY kind, category, table_name`,
    vals,
  );
  return rows.map((r) => ({
    kind: r.kind,
    category: r.category,
    tableName: r.table_name,
    partnerId: r.partner_id,
    cash: int(r.cash),
    bank: int(r.bank),
    count: int(r.n),
  }));
}

export async function reportData(from: string, to: string): Promise<ReportData> {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new AccountsError("Pick a valid period");
  if (from > to) [from, to] = [to, from];
  const [opening, closing, period, cumulative] = await Promise.all([
    balances({ before: from }),
    balances({ upto: to }),
    grouped(`date BETWEEN $1 AND $2`, [from, to]),
    grouped(`date <= $1`, [to]),
  ]);
  return { from, to, opening, closing, period, cumulative };
}
