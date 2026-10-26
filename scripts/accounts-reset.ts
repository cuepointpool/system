/* ============================================================
   Accounts reset — start the books from a clean slate.

     npm run accounts:reset -- --yes            clear + set shares
     npm run accounts:reset -- --yes --opening  …and load the opening position

   1. Sets each active investor's ownership share from SHARES (matched by
      name). If any investor isn't listed there, falls back to whole-number
      shares from recorded capital (or an equal split) adding up to 100.
   2. Clears every accounting record: the ledger, the cash box, and the
      old finance module's capital contributions + expenses.
      Players, admins, staff and the investors themselves are kept.
   3. With --opening, records the position at the end of 25 Oct 2026
      (OPENING below) as the first day in the books.

   Needs db/migrations/2026-10-26-accounting.sql applied first.
   ============================================================ */

import pg from "pg";

const OPENING_DATE = "2026-10-25";
const OPENING: {
  kind: "opening" | "income" | "expense";
  category: string;
  description: string;
  cash?: number;
  bank?: number;
}[] = [
  { kind: "opening", category: "Opening balance", description: "Opening income — bank", bank: 94_700 },
  { kind: "opening", category: "Opening balance", description: "Cashier balance (cash box)", cash: 7_520 },
  { kind: "income", category: "Other income", description: "Bank income", bank: 38_100 },
  { kind: "income", category: "Other income", description: "Cash income banked (cash bank)", bank: 14_000 },
  { kind: "expense", category: "Rent", description: "Rent", bank: 60_000 },
  { kind: "expense", category: "Snacks stock", description: "Snacks", bank: 7_680 },
  { kind: "expense", category: "Transport (PickMe / taxi)", description: "PickMe", bank: 380 },
];

/** Agreed ownership, by (part of) the investor's name. */
const SHARES: Record<string, number> = { dilantha: 34, isuru: 32, tharush: 21, arjuna: 13 };

const args = new Set(process.argv.slice(2));
if (!args.has("--yes")) {
  console.error("This clears all accounting data. Re-run with --yes to confirm.");
  process.exit(1);
}

/** Whole-number shares that add up to 100 (largest remainder). */
function roundShares(weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (total ? (w / total) * 100 : 100 / weights.length));
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("→ accounts reset on", new URL(process.env.DATABASE_URL!).pathname.slice(1));
  await client.query("BEGIN");
  try {
    const { rows: partners } = await client.query<{ id: string; name: string; capital: string }>(
      `SELECT p.id, p.name, COALESCE(SUM(c.amount), 0) AS capital
         FROM business_partners p
         LEFT JOIN capital_contributions c ON c.partner_id = p.id
        WHERE p.active
        GROUP BY p.id, p.name, p.sort_order
        ORDER BY p.sort_order`,
    );
    const named = partners.map(
      (p) => Object.entries(SHARES).find(([k]) => p.name.toLowerCase().includes(k))?.[1],
    );
    const shares = named.every((v) => v !== undefined)
      ? (named as number[])
      : roundShares(partners.map((p) => Number(p.capital)));
    if (named.some((v) => v === undefined))
      console.warn("! not every investor matched SHARES — using shares from recorded capital");
    await client.query(`UPDATE business_partners SET share_pct = 0 WHERE NOT active`);
    for (let i = 0; i < partners.length; i++) {
      await client.query(`UPDATE business_partners SET share_pct = $2 WHERE id = $1`, [
        partners[i].id,
        shares[i],
      ]);
      console.log(`  ${partners[i].name.padEnd(20)} ${String(shares[i]).padStart(3)}%`);
    }

    for (const t of ["acct_entries", "acct_entry_log", "cash_days", "capital_contributions", "business_expenses"]) {
      const r = await client.query(`DELETE FROM ${t}`);
      console.log(`✓ cleared ${t} (${r.rowCount})`);
    }

    if (args.has("--opening")) {
      let n = 0;
      for (const e of OPENING) {
        n++;
        await client.query(
          `INSERT INTO acct_entries (id, date, kind, category, description, cash, bank, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'opening-setup')`,
          [
            `ae_open_${n}`,
            OPENING_DATE,
            e.kind,
            e.category,
            e.description,
            e.cash ?? 0,
            e.bank ?? 0,
          ],
        );
      }
      // the cash box sat at the cashier balance all day
      const cashBox = OPENING.filter((e) => e.kind === "opening").reduce((s, e) => s + (e.cash ?? 0), 0);
      await client.query(
        `INSERT INTO cash_days (date, opening_amount, opening_note, opened_by, opened_at,
                                closing_amount, closing_note, closed_by, closed_at)
         VALUES ($1,$2,'Starting point','opening-setup',now(),$2,'Starting point','opening-setup',now())`,
        [OPENING_DATE, cashBox],
      );
      console.log(`✓ opening position for ${OPENING_DATE}: ${OPENING.length} entries, cash box ${cashBox}`);
    }

    await client.query("COMMIT");
    const { rows } = await client.query<{ cash: string; bank: string }>(
      `SELECT COALESCE(SUM(CASE WHEN kind IN ('opening','income','capital','withdrawal') THEN cash ELSE -cash END),0) AS cash,
              COALESCE(SUM(CASE WHEN kind IN ('opening','income','capital','deposit') THEN bank ELSE -bank END),0) AS bank
         FROM acct_entries`,
    );
    console.log(`  balances → cash ${rows[0].cash} · bank ${rows[0].bank}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
