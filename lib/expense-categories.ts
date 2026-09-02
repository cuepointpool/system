/* Shared, client-safe list of business-expense categories.
   Kept dependency-free so both the admin console (client) and the
   finance API (server) can import it. "Other" lets staff type a
   one-off label; the API accepts any non-empty category. */

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Internet & phone",
  "Salaries & wages",
  "Table maintenance (cloth, tips, levelling)",
  "Equipment (cues, balls, racks)",
  "Bar & refreshment stock",
  "Cleaning & supplies",
  "Repairs & maintenance",
  "Furniture & fixtures",
  "Marketing & promotions",
  "Tournament costs (prizes, hosting)",
  "Licenses & government fees",
  "Professional fees (accounting, legal)",
  "Transport",
  "Bank & payment charges",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const OTHER_CATEGORY = "Other";
