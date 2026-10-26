/* Shared, client-safe accounting vocabulary: entry kinds, income and
   expense categories, and how each one lands on the P&L. Kept
   dependency-free so the console (client) and the API (server) agree.
   The API accepts any non-empty category, so "Other" can be free text. */

export const ENTRY_KINDS = [
  "opening",
  "income",
  "expense",
  "deposit",
  "withdrawal",
  "capital",
  "drawing",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const KIND_LABELS: Record<EntryKind, string> = {
  opening: "Opening balance",
  income: "Income",
  expense: "Expense",
  deposit: "Bank deposit",
  withdrawal: "Bank withdrawal",
  capital: "Investor capital",
  drawing: "Investor withdrawal",
};

/** Table play is the one income category that carries a table + times. */
export const TABLE_INCOME = "Table play";

export const INCOME_CATEGORIES = [
  TABLE_INCOME,
  "Snacks",
  "Water bottles",
  "Soft drinks",
  "Short eats",
  "Tournament entry fees",
  "Membership fees",
  "Coaching",
  "Cash over (till)",
  "Other income",
] as const;

/** Quick-add chips on the day book (everything but table play). */
export const QUICK_INCOME = [
  "Snacks",
  "Water bottles",
  "Soft drinks",
  "Short eats",
  "Tournament entry fees",
  "Membership fees",
  "Other income",
] as const;

export type ExpenseGroup = "cogs" | "opex" | "tax";

/** Expense categories and their P&L section. Stock bought for resale is cost of sales. */
export const EXPENSE_CATEGORIES: { label: string; group: ExpenseGroup }[] = [
  { label: "Snacks stock", group: "cogs" },
  { label: "Drinks & water stock", group: "cogs" },
  { label: "Rent", group: "opex" },
  { label: "Electricity", group: "opex" },
  { label: "Water bill", group: "opex" },
  { label: "Internet & phone", group: "opex" },
  { label: "Salaries & wages", group: "opex" },
  { label: "Transport (PickMe / taxi)", group: "opex" },
  { label: "Table maintenance", group: "opex" },
  { label: "Equipment (cues, balls, chalk)", group: "opex" },
  { label: "Cleaning & supplies", group: "opex" },
  { label: "Repairs", group: "opex" },
  { label: "Marketing & promotions", group: "opex" },
  { label: "Tournament prizes & costs", group: "opex" },
  { label: "Licences & government fees", group: "opex" },
  { label: "Professional fees", group: "opex" },
  { label: "Bank charges", group: "opex" },
  { label: "Cash short (till)", group: "opex" },
  { label: "Other expense", group: "opex" },
  { label: "Tax paid", group: "tax" },
];

export function expenseGroup(category: string): ExpenseGroup {
  return EXPENSE_CATEGORIES.find((c) => c.label === category)?.group ?? "opex";
}

/** Signed effect of one entry on the cash box and the bank. */
export function entryEffect(e: {
  kind: EntryKind;
  cash: number;
  bank: number;
}): { cash: number; bank: number } {
  switch (e.kind) {
    case "opening":
    case "income":
    case "capital":
      return { cash: e.cash, bank: e.bank };
    case "expense":
    case "drawing":
      return { cash: -e.cash, bank: -e.bank };
    case "deposit":
      return { cash: -e.cash, bank: e.bank };
    case "withdrawal":
      return { cash: e.cash, bank: -e.bank };
  }
}
