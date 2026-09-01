import { audit, rid } from "./ecosystem/store";
import { query } from "./pg";

/* ------------------------------------------------------------------
   Business finance — raw SQL against Postgres (see db/schema.sql).
   Partners + their capital, business expenses (with receipt images),
   the daily cash drawer, and a rolled-up summary. Admin-only.
   ------------------------------------------------------------------ */

export type ExpenseSource = "capital" | "revenue";

export interface Partner {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}
export interface Contribution {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  note: string;
  at: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string;
}
export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  source: ExpenseSource;
  spentAt: string; // YYYY-MM-DD
  hasReceipt: boolean;
  createdBy: string;
  createdAt: string;
}
export interface CashDay {
  date: string;
  openingAmount: number | null;
  openingType: string;
  openingNote: string;
  openedBy: string | null;
  openedAt: string | null;
  closingAmount: number | null;
  closingType: string;
  closingNote: string;
  closedBy: string | null;
  closedAt: string | null;
}

const iso = (v: Date | string | null): string | null =>
  !v ? null : v instanceof Date ? v.toISOString() : String(v);
const ymd = (v: Date | string): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const int = (v: unknown): number => Math.trunc(Number(v) || 0);

/* ------------------------------- partners ------------------------------- */

interface PartnerRow {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
}
const toPartner = (r: PartnerRow): Partner => ({
  id: r.id,
  name: r.name,
  active: r.active,
  sortOrder: Number(r.sort_order),
});

export async function listPartners(): Promise<Partner[]> {
  const rows = await query<PartnerRow>(
    `SELECT * FROM business_partners ORDER BY sort_order, created_at`,
  );
  return rows.map(toPartner);
}

export async function createPartner(
  name: string,
  actor: string,
): Promise<Partner> {
  const id = "bp_" + rid().slice(0, 8);
  const max = await query<{ m: number | null }>(
    `SELECT MAX(sort_order) AS m FROM business_partners`,
  );
  const order = Number(max[0]?.m ?? -1) + 1;
  await query(
    `INSERT INTO business_partners (id, name, sort_order) VALUES ($1,$2,$3)`,
    [id, name.trim(), order],
  );
  await audit(actor, "finance.partner.create", "partner", id, name.trim());
  return (await listPartners()).find((p) => p.id === id)!;
}

export async function updatePartner(
  id: string,
  patch: { name?: string; active?: boolean },
  actor: string,
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.name !== undefined) {
    vals.push(patch.name.trim());
    sets.push(`name = $${vals.length}`);
  }
  if (patch.active !== undefined) {
    vals.push(!!patch.active);
    sets.push(`active = $${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(id);
  await query(
    `UPDATE business_partners SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals,
  );
  await audit(actor, "finance.partner.update", "partner", id, sets.join(", "));
}

export async function deletePartner(id: string, actor: string): Promise<void> {
  await query(`DELETE FROM business_partners WHERE id = $1`, [id]);
  await audit(actor, "finance.partner.delete", "partner", id, "");
}

/* ---------------------------- contributions ---------------------------- */

interface ContributionRow {
  id: string;
  partner_id: string;
  partner_name: string;
  amount: string | number;
  note: string;
  at: Date | string;
  created_by: string;
  created_at: Date | string;
}
const toContribution = (r: ContributionRow): Contribution => ({
  id: r.id,
  partnerId: r.partner_id,
  partnerName: r.partner_name,
  amount: int(r.amount),
  note: r.note,
  at: ymd(r.at),
  createdBy: r.created_by,
  createdAt: iso(r.created_at)!,
});

export async function listContributions(): Promise<Contribution[]> {
  const rows = await query<ContributionRow>(
    `SELECT c.*, p.name AS partner_name
       FROM capital_contributions c
       JOIN business_partners p ON p.id = c.partner_id
      ORDER BY c.at DESC, c.created_at DESC`,
  );
  return rows.map(toContribution);
}

export async function addContribution(
  input: { partnerId: string; amount: number; note?: string; at?: string },
  actor: string,
): Promise<void> {
  const id = "cc_" + rid().slice(0, 10);
  await query(
    `INSERT INTO capital_contributions (id, partner_id, amount, note, at, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6)`,
    [
      id,
      input.partnerId,
      Math.max(0, int(input.amount)),
      (input.note ?? "").trim(),
      input.at || null,
      actor,
    ],
  );
  await audit(
    actor,
    "finance.contribution.add",
    "partner",
    input.partnerId,
    `LKR ${int(input.amount)}`,
  );
}

export async function deleteContribution(
  id: string,
  actor: string,
): Promise<void> {
  await query(`DELETE FROM capital_contributions WHERE id = $1`, [id]);
  await audit(actor, "finance.contribution.delete", "contribution", id, "");
}

/* ------------------------------- expenses ------------------------------- */

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: string | number;
  source: string;
  spent_at: Date | string;
  has_receipt: boolean;
  created_by: string;
  created_at: Date | string;
}
const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  category: r.category,
  description: r.description,
  amount: int(r.amount),
  source: r.source === "capital" ? "capital" : "revenue",
  spentAt: ymd(r.spent_at),
  hasReceipt: !!r.has_receipt,
  createdBy: r.created_by,
  createdAt: iso(r.created_at)!,
});

export async function listExpenses(opts: { from?: string; to?: string } = {}): Promise<
  Expense[]
> {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (opts.from) {
    vals.push(opts.from);
    where.push(`spent_at >= $${vals.length}`);
  }
  if (opts.to) {
    vals.push(opts.to);
    where.push(`spent_at <= $${vals.length}`);
  }
  const rows = await query<ExpenseRow>(
    `SELECT id, category, description, amount, source, spent_at,
            (receipt_image IS NOT NULL) AS has_receipt, created_by, created_at
       FROM business_expenses
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY spent_at DESC, created_at DESC
      LIMIT 500`,
    vals,
  );
  return rows.map(toExpense);
}

export async function getExpenseReceipt(id: string): Promise<string | null> {
  const rows = await query<{ receipt_image: string | null }>(
    `SELECT receipt_image FROM business_expenses WHERE id = $1`,
    [id],
  );
  return rows[0]?.receipt_image ?? null;
}

export async function addExpense(
  input: {
    category: string;
    description?: string;
    amount: number;
    source: ExpenseSource;
    spentAt?: string;
    receiptImage?: string | null;
  },
  actor: string,
): Promise<Expense> {
  const id = "ex_" + rid().slice(0, 10);
  await query(
    `INSERT INTO business_expenses
       (id, category, description, amount, source, spent_at, receipt_image, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8)`,
    [
      id,
      input.category.trim(),
      (input.description ?? "").trim(),
      Math.max(0, int(input.amount)),
      input.source === "capital" ? "capital" : "revenue",
      input.spentAt || null,
      input.receiptImage || null,
      actor,
    ],
  );
  await audit(
    actor,
    "finance.expense.add",
    "expense",
    id,
    `${input.category.trim()} · LKR ${int(input.amount)} · from ${input.source}`,
  );
  const rows = await query<ExpenseRow>(
    `SELECT id, category, description, amount, source, spent_at,
            (receipt_image IS NOT NULL) AS has_receipt, created_by, created_at
       FROM business_expenses WHERE id = $1`,
    [id],
  );
  return toExpense(rows[0]);
}

export async function deleteExpense(id: string, actor: string): Promise<void> {
  await query(`DELETE FROM business_expenses WHERE id = $1`, [id]);
  await audit(actor, "finance.expense.delete", "expense", id, "");
}

/* ------------------------------ cash drawer ---------------------------- */

interface CashRow {
  date: Date | string;
  opening_amount: string | number | null;
  opening_type: string;
  opening_note: string;
  opened_by: string | null;
  opened_at: Date | string | null;
  closing_amount: string | number | null;
  closing_type: string;
  closing_note: string;
  closed_by: string | null;
  closed_at: Date | string | null;
}
const toCashDay = (r: CashRow): CashDay => ({
  date: ymd(r.date),
  openingAmount: r.opening_amount == null ? null : int(r.opening_amount),
  openingType: r.opening_type,
  openingNote: r.opening_note,
  openedBy: r.opened_by,
  openedAt: iso(r.opened_at),
  closingAmount: r.closing_amount == null ? null : int(r.closing_amount),
  closingType: r.closing_type,
  closingNote: r.closing_note,
  closedBy: r.closed_by,
  closedAt: iso(r.closed_at),
});

export async function listCashDays(limit = 60): Promise<CashDay[]> {
  const rows = await query<CashRow>(
    `SELECT * FROM cash_days ORDER BY date DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toCashDay);
}

export async function setCashPhase(
  input: {
    date: string;
    phase: "open" | "close";
    amount: number;
    type?: string;
    note?: string;
  },
  actor: string,
): Promise<CashDay> {
  const amount = Math.max(0, int(input.amount));
  const type = (input.type ?? "").trim();
  const note = (input.note ?? "").trim();
  if (input.phase === "open") {
    await query(
      `INSERT INTO cash_days (date, opening_amount, opening_type, opening_note, opened_by, opened_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (date) DO UPDATE SET
         opening_amount = EXCLUDED.opening_amount,
         opening_type = EXCLUDED.opening_type,
         opening_note = EXCLUDED.opening_note,
         opened_by = EXCLUDED.opened_by,
         opened_at = now()`,
      [input.date, amount, type, note, actor],
    );
  } else {
    await query(
      `INSERT INTO cash_days (date, closing_amount, closing_type, closing_note, closed_by, closed_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (date) DO UPDATE SET
         closing_amount = EXCLUDED.closing_amount,
         closing_type = EXCLUDED.closing_type,
         closing_note = EXCLUDED.closing_note,
         closed_by = EXCLUDED.closed_by,
         closed_at = now()`,
      [input.date, amount, type, note, actor],
    );
  }
  await audit(
    actor,
    `finance.cash.${input.phase}`,
    "cash_day",
    input.date,
    `LKR ${amount}${type ? ` · ${type}` : ""}`,
  );
  const rows = await query<CashRow>(`SELECT * FROM cash_days WHERE date = $1`, [
    input.date,
  ]);
  return toCashDay(rows[0]);
}

/* -------------------------------- summary ----------------------------- */

export interface PartnerPosition {
  id: string;
  name: string;
  contributed: number;
  pct: number; // 0–100, 1dp
}
export interface DailyLine {
  date: string;
  revenueGross: number;
  revenueCollected: number;
  expenses: number;
  bookings: number;
}
export interface FinanceSummary {
  capitalContributed: number;
  capitalSpent: number;
  capitalBalance: number;
  revenueGross: number;
  revenueCollected: number;
  revenueSpent: number;
  operatingBalance: number; // collected − revenue-sourced expenses
  businessBalance: number; // capitalBalance + operatingBalance
  expensesTotal: number;
  partners: PartnerPosition[];
  daily: DailyLine[]; // last 30 days, newest first
}

export async function financeSummary(): Promise<FinanceSummary> {
  const [contribByPartner, expenseAgg, revAgg, daily] = await Promise.all([
    query<{ partner_id: string; name: string; total: string }>(
      `SELECT p.id AS partner_id, p.name,
              COALESCE(SUM(c.amount), 0) AS total
         FROM business_partners p
         LEFT JOIN capital_contributions c ON c.partner_id = p.id
        WHERE p.active = TRUE
        GROUP BY p.id, p.name, p.sort_order
        ORDER BY p.sort_order`,
    ),
    query<{ source: string; total: string }>(
      `SELECT source, COALESCE(SUM(amount), 0) AS total
         FROM business_expenses GROUP BY source`,
    ),
    query<{ gross: string; collected: string }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS gross,
              COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS collected
         FROM bookings WHERE status <> 'CANCELLED'`,
    ),
    query<{
      date: Date | string;
      gross: string;
      collected: string;
      bookings: string;
    }>(
      `SELECT date,
              COALESCE(SUM(total_amount), 0) AS gross,
              COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS collected,
              COUNT(*) AS bookings
         FROM bookings
        WHERE status <> 'CANCELLED' AND date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date ORDER BY date DESC`,
    ),
  ]);

  const capitalContributed = contribByPartner.reduce(
    (s, r) => s + int(r.total),
    0,
  );
  const bySource = new Map(expenseAgg.map((r) => [r.source, int(r.total)]));
  const capitalSpent = bySource.get("capital") ?? 0;
  const revenueSpent = bySource.get("revenue") ?? 0;
  const expensesTotal = capitalSpent + revenueSpent;
  const revenueGross = int(revAgg[0]?.gross);
  const revenueCollected = int(revAgg[0]?.collected);

  const capitalBalance = capitalContributed - capitalSpent;
  const operatingBalance = revenueCollected - revenueSpent;

  const expByDay = new Map<string, number>();
  const expDaily = await query<{ d: Date | string; total: string }>(
    `SELECT spent_at AS d, COALESCE(SUM(amount),0) AS total
       FROM business_expenses
      WHERE spent_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY spent_at`,
  );
  for (const r of expDaily) expByDay.set(ymd(r.d), int(r.total));

  const partners: PartnerPosition[] = contribByPartner.map((r) => ({
    id: r.partner_id,
    name: r.name,
    contributed: int(r.total),
    pct: capitalContributed
      ? +((int(r.total) / capitalContributed) * 100).toFixed(1)
      : 0,
  }));

  return {
    capitalContributed,
    capitalSpent,
    capitalBalance,
    revenueGross,
    revenueCollected,
    revenueSpent,
    operatingBalance,
    businessBalance: capitalBalance + operatingBalance,
    expensesTotal,
    partners,
    daily: daily.map((r) => ({
      date: ymd(r.date),
      revenueGross: int(r.gross),
      revenueCollected: int(r.collected),
      bookings: int(r.bookings),
      expenses: expByDay.get(ymd(r.date)) ?? 0,
    })),
  };
}
