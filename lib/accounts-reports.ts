/* Pure, client-safe statement maths shared by the on-screen reports and
   the signed balance-sheet PDF, so both always show the same figures. */

import { TABLE_INCOME, expenseGroup, type EntryKind } from "./accounts-categories";

export type Balances = { cash: number; bank: number };

export type ReportLine = {
  kind: EntryKind;
  category: string;
  tableName: string | null;
  partnerId: string | null;
  cash: number;
  bank: number;
  count: number;
};

export type ReportData = {
  from: string;
  to: string;
  opening: Balances; // before `from`
  closing: Balances; // at end of `to`
  period: ReportLine[];
  cumulative: ReportLine[];
};

export const lineAmount = (l: ReportLine) => l.cash + l.bank;

/** Sum lines of one kind by category, biggest first. */
export function byCategory(lines: ReportLine[], kind: EntryKind): [string, number][] {
  const m = new Map<string, number>();
  for (const l of lines)
    if (l.kind === kind) {
      const k = l.category || "Uncategorised";
      m.set(k, (m.get(k) ?? 0) + lineAmount(l));
    }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function profitFigures(lines: ReportLine[], taxRate: number) {
  const income = byCategory(lines, "income");
  const tables = new Map<string, number>();
  for (const l of lines)
    if (l.kind === "income" && l.category === TABLE_INCOME)
      tables.set(l.tableName ?? "Tables", (tables.get(l.tableName ?? "Tables") ?? 0) + lineAmount(l));
  const expenses = byCategory(lines, "expense");
  const cogs = expenses.filter(([c]) => expenseGroup(c) === "cogs");
  // with tax on, "Tax paid" settles the provision instead of being a running cost
  const opex = expenses.filter(([c]) => expenseGroup(c) === "opex" || (!taxRate && expenseGroup(c) === "tax"));
  const taxPaid = expenses.filter(([c]) => expenseGroup(c) === "tax").reduce((s, [, v]) => s + v, 0);
  const revenue = income.reduce((s, [, v]) => s + v, 0);
  const cogsT = cogs.reduce((s, [, v]) => s + v, 0);
  const opexT = opex.reduce((s, [, v]) => s + v, 0);
  const gross = revenue - cogsT;
  const beforeTax = gross - opexT;
  const taxProvision = taxRate ? Math.round((Math.max(0, beforeTax) * taxRate) / 100) : 0;
  return { income, tables, cogs, opex, revenue, cogsT, opexT, gross, beforeTax, taxProvision, taxPaid, net: beforeTax - taxProvision };
}

/** Balance sheet as at `data.to`, from every entry up to that date. */
export function balanceSheetFigures(data: ReportData, taxRate: number) {
  const cum = data.cumulative;
  const sum = (k: EntryKind) => cum.filter((l) => l.kind === k).reduce((s, l) => s + lineAmount(l), 0);
  const f = profitFigures(cum, taxRate);
  const taxPayable = taxRate ? f.taxProvision - f.taxPaid : 0;
  const cash = data.closing.cash;
  const bank = data.closing.bank;
  const assets = cash + bank;
  const opening = sum("opening");
  const capital = sum("capital");
  const drawings = sum("drawing");
  const retained = f.net;
  const equity = opening + capital + retained - drawings;
  return {
    cash,
    bank,
    assets,
    taxPayable,
    opening,
    capital,
    drawings,
    retained,
    equity,
    balanced: equity + taxPayable === assets,
  };
}
