"use client";

import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { TABLE_INCOME, type EntryKind } from "@/lib/accounts-categories";
import {
  balanceSheetFigures,
  profitFigures,
  type ReportData,
} from "@/lib/accounts-reports";
import { Seg, Toggle, addDays, fmt, longDate, useAccounts, useView, type Investor } from "./ui";

type Kind = "pl" | "cf" | "bs";
type Preset = "today" | "yesterday" | "month" | "last" | "year" | "all" | "custom";

const TITLES: Record<Kind, string> = {
  pl: "Profit & Loss Statement",
  cf: "Cash Flow Statement",
  bs: "Balance Sheet",
};

export function Reports() {
  const { meta } = useAccounts();
  const [kind, setKind] = useState<Kind>("pl");
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState({ from: meta.today.slice(0, 8) + "01", to: meta.today });
  const [tax, setTax] = useState(false);
  const [rate, setRate] = useState("30");
  const [sign, setSign] = useState(false);

  const range = periodFor(preset, meta.today, custom);
  const { data, err } = useView<ReportData>({ view: "report", ...range });
  const taxRate = tax ? Math.min(100, Math.max(0, Number(rate) || 0)) : 0;
  const investors = meta.partners.filter((p) => p.active);

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="no-print space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Seg
            value={kind}
            onChange={setKind}
            options={[
              { value: "pl", label: "Profit & Loss" },
              { value: "cf", label: "Cash Flow" },
              { value: "bs", label: "Balance Sheet" },
            ]}
          />
          <button onClick={() => window.print()} className="btn-primary px-5 py-2 text-xs">
            Print / save PDF
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
          <Seg
            size="sm"
            value={preset}
            onChange={setPreset}
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "month", label: "This month" },
              { value: "last", label: "Last month" },
              { value: "year", label: "This year" },
              { value: "all", label: "All time" },
              { value: "custom", label: "Custom" },
            ]}
          />
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="input h-8 w-36 text-xs" />
              <span className="text-xs text-mist">to</span>
              <input type="date" value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="input h-8 w-36 text-xs" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.07] pt-4">
          {kind !== "cf" && (
            <div className="flex items-center gap-2">
              <Toggle on={tax} onChange={setTax} label="Include income tax" />
              {tax && (
                <span className="flex items-center gap-1 text-xs text-mist">
                  @
                  <input
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
                    className="input h-7 w-14 text-center text-xs"
                  />
                  %
                </span>
              )}
            </div>
          )}
          <Toggle on={sign} onChange={setSign} label="Investor signatures & approval" />
          {kind !== "cf" && !tax && (
            <span className="text-[11px] text-mist">No tax applied — the business isn&apos;t paying tax yet.</span>
          )}
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-mist">{err ?? "Building report…"}</p>
      ) : (
        <Paper title={TITLES[kind]} data={data} kind={kind} today={meta.today}>
          {kind === "pl" && <ProfitLoss data={data} taxRate={taxRate} investors={investors} />}
          {kind === "cf" && <CashFlow data={data} />}
          {kind === "bs" && <BalanceSheet data={data} taxRate={taxRate} investors={investors} />}
          {sign && <Signatures investors={investors} />}
        </Paper>
      )}
    </div>
  );
}

function periodFor(p: Preset, today: string, custom: { from: string; to: string }) {
  const y = today.slice(0, 4);
  const monthStart = today.slice(0, 8) + "01";
  // `today` is the business day (12 PM–6 AM), so "Today" at 2 AM is still last night
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case "month":
      return { from: monthStart, to: today };
    case "last": {
      const lastEnd = addDays(monthStart, -1);
      return { from: lastEnd.slice(0, 8) + "01", to: lastEnd };
    }
    case "year":
      return { from: `${y}-01-01`, to: today };
    case "all":
      return { from: "2000-01-01", to: today };
    case "custom":
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }
}

/* ------------------------------ paper shell ------------------------------ */

export function Paper({
  title,
  data,
  kind,
  today,
  children,
}: {
  title: string;
  data: ReportData;
  kind: Kind;
  today: string;
  children: React.ReactNode;
}) {
  const period =
    kind === "bs"
      ? `As at ${longDate(data.to)}`
      : data.from === "2000-01-01"
        ? `From the start of the books to ${longDate(data.to)}`
        : `For the period ${longDate(data.from)} – ${longDate(data.to)}`;
  return (
    <article className="print-area mx-auto max-w-[820px] rounded-2xl bg-[#fbfaf7] px-6 py-8 text-slate-800 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:px-12 sm:py-12">
      <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-5">
        <div>
          <p className="font-display text-2xl font-bold tracking-[0.18em] text-slate-900">CUE POINT</p>
          <p className="text-[11px] tracking-wide text-slate-500">Pool &amp; Billiards · Pitipana, Homagama</p>
        </div>
        <div className="text-right">
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{period}</p>
          <p className="text-[10px] text-slate-400">Amounts in Sri Lankan Rupees (LKR)</p>
        </div>
      </header>
      <div className="mt-6">{children}</div>
      <footer className="mt-10 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        Generated {longDate(today)} from the Cue Point accounts ledger.
      </footer>
    </article>
  );
}

/* ------------------------------ table bits ------------------------------ */

const n = (v: number) => (Math.round(v) < 0 ? `(${fmt(-v)})` : fmt(v));

function Section({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={4} className="pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-deep">
        {title}
      </td>
    </tr>
  );
}

function L({
  label,
  v,
  indent = 1,
  col = "a",
  muted,
}: {
  label: string;
  v: number;
  indent?: number;
  col?: "a" | "b";
  muted?: boolean;
}) {
  return (
    <tr className={cn("text-[13px]", muted && "text-slate-500")}>
      <td className="py-1" style={{ paddingLeft: indent * 14 }} colSpan={2}>
        {label}
      </td>
      <td className="w-28 py-1 text-right tabular-nums">{col === "a" ? n(v) : ""}</td>
      <td className="w-28 py-1 text-right tabular-nums">{col === "b" ? n(v) : ""}</td>
    </tr>
  );
}

function Total({ label, v, strong, double }: { label: string; v: number; strong?: boolean; double?: boolean }) {
  return (
    <tr className={cn("text-[13px]", strong && "font-bold text-slate-900")}>
      <td className="py-1.5" colSpan={2}>
        {label}
      </td>
      <td />
      <td
        className={cn(
          "w-28 py-1.5 text-right tabular-nums",
          double ? "border-b-[3px] border-double border-slate-800 border-t border-t-slate-800" : "border-t border-slate-300",
        )}
      >
        {n(v)}
      </td>
    </tr>
  );
}

function Doc({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse">
      <tbody>{children}</tbody>
    </table>
  );
}

/* ------------------------------ P&L ------------------------------ */

function ProfitLoss({ data, taxRate, investors }: { data: ReportData; taxRate: number; investors: Investor[] }) {
  const f = profitFigures(data.period, taxRate);
  return (
    <>
      <Doc>
        <Section title="Revenue" />
        {f.income.map(([cat, v]) =>
          cat === TABLE_INCOME && f.tables.size > 1 ? (
            <Fragment key={cat}>
              <L label={cat} v={v} col="a" muted />
              {[...f.tables.entries()].map(([t, tv]) => (
                <L key={t} label={t} v={tv} indent={2} muted />
              ))}
            </Fragment>
          ) : (
            <L key={cat} label={cat} v={v} />
          ),
        )}
        {f.income.length === 0 && <L label="No income recorded" v={0} muted />}
        <Total label="Total revenue" v={f.revenue} strong />

        <Section title="Cost of sales" />
        {f.cogs.map(([c, v]) => (
          <L key={c} label={c} v={v} />
        ))}
        {f.cogs.length === 0 && <L label="Stock purchases for resale" v={0} muted />}
        <Total label="Total cost of sales" v={f.cogsT} />
        <Total label="Gross profit" v={f.gross} strong />

        <Section title="Operating expenses" />
        {f.opex.map(([c, v]) => (
          <L key={c} label={c} v={v} />
        ))}
        {f.opex.length === 0 && <L label="No expenses recorded" v={0} muted />}
        <Total label="Total operating expenses" v={f.opexT} />

        {taxRate ? (
          <>
            <Total label={f.beforeTax >= 0 ? "Net profit before tax" : "Net loss before tax"} v={f.beforeTax} strong />
            <L label={`Income tax @ ${taxRate}%${f.beforeTax <= 0 ? " (no tax on a loss)" : ""}`} v={-f.taxProvision} indent={0} col="b" />
            <Total label={f.net >= 0 ? "Net profit after tax" : "Net loss after tax"} v={f.net} strong double />
          </>
        ) : (
          <Total label={f.net >= 0 ? "Net profit" : "Net loss"} v={f.net} strong double />
        )}
      </Doc>

      {investors.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-deep">Share of {f.net >= 0 ? "profit" : "loss"} by investor</p>
          <table className="mt-2 w-full text-[13px]">
            <tbody>
              {investors.map((p) => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="py-1.5">{p.name}</td>
                  <td className="w-20 py-1.5 text-right tabular-nums text-slate-500">{p.sharePct}%</td>
                  <td className="w-28 py-1.5 text-right tabular-nums">{n(Math.round((f.net * p.sharePct) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------ cash flow ------------------------------ */

function CFRow({ label, c, b, strong, rule, indent = 1 }: { label: string; c: number; b: number; strong?: boolean; rule?: boolean; indent?: number }) {
  return (
    <tr className={cn("text-[13px]", strong && "font-bold text-slate-900", rule && "border-t border-slate-300")}>
      <td className="py-1" style={{ paddingLeft: indent * 14 }}>
        {label}
      </td>
      <td className="w-24 py-1 text-right tabular-nums">{n(c)}</td>
      <td className="w-24 py-1 text-right tabular-nums">{n(b)}</td>
      <td className="w-28 py-1 text-right tabular-nums">{n(c + b)}</td>
    </tr>
  );
}

function CashFlow({ data }: { data: ReportData }) {
  const sumBy = (kind: EntryKind) => {
    const m = new Map<string, { c: number; b: number }>();
    for (const l of data.period)
      if (l.kind === kind) {
        const k = l.category || "Uncategorised";
        const cur = m.get(k) ?? { c: 0, b: 0 };
        m.set(k, { c: cur.c + l.cash, b: cur.b + l.bank });
      }
    return [...m.entries()].sort((a, b) => b[1].c + b[1].b - (a[1].c + a[1].b));
  };
  const tot = (rows: [string, { c: number; b: number }][], sign = 1) =>
    rows.reduce((s, [, v]) => ({ c: s.c + sign * v.c, b: s.b + sign * v.b }), { c: 0, b: 0 });
  const receipts = sumBy("income");
  const payments = sumBy("expense");
  const R = tot(receipts);
  const P = tot(payments, -1);
  const op = { c: R.c + P.c, b: R.b + P.b };
  const cap = tot(sumBy("capital"));
  const draw = tot(sumBy("drawing"), -1);
  const openIn = tot(sumBy("opening"));
  const dep = data.period.filter((l) => l.kind === "deposit").reduce((s, l) => s + l.cash, 0);
  const wd = data.period.filter((l) => l.kind === "withdrawal").reduce((s, l) => s + l.cash, 0);
  const fin = { c: cap.c + draw.c + openIn.c, b: cap.b + draw.b + openIn.b };
  const tr = { c: -dep + wd, b: dep - wd };
  const net = { c: op.c + fin.c + tr.c, b: op.b + fin.b + tr.b };
  const closing = { c: data.opening.cash + net.c, b: data.opening.bank + net.b };

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
          <th className="py-1.5 text-left font-semibold" />
          <th className="py-1.5 text-right font-semibold">Cash</th>
          <th className="py-1.5 text-right font-semibold">Bank</th>
          <th className="py-1.5 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        <CFRow label="Opening balance" c={data.opening.cash} b={data.opening.bank} strong indent={0} />

        <Section title="Operating activities" />
        {receipts.map(([k, v]) => (
          <CFRow key={k} label={`Received — ${k}`} c={v.c} b={v.b} />
        ))}
        {payments.map(([k, v]) => (
          <CFRow key={k} label={`Paid — ${k}`} c={-v.c} b={-v.b} />
        ))}
        {receipts.length + payments.length === 0 && <CFRow label="No operating movements" c={0} b={0} />}
        <CFRow label="Net cash from operations" c={op.c} b={op.b} strong rule indent={0} />

        <Section title="Investors & opening balances" />
        {(openIn.c || openIn.b) !== 0 && <CFRow label="Opening balances brought in" c={openIn.c} b={openIn.b} />}
        <CFRow label="Capital introduced" c={cap.c} b={cap.b} />
        <CFRow label="Investor withdrawals" c={draw.c} b={draw.b} />
        <CFRow label="Net from investors" c={fin.c} b={fin.b} strong rule indent={0} />

        <Section title="Transfers between cash and bank" />
        <CFRow label="Cash deposited to bank" c={-dep} b={dep} />
        <CFRow label="Cash withdrawn from bank" c={wd} b={-wd} />
        <CFRow label="Net transfers" c={tr.c} b={tr.b} strong rule indent={0} />

        <tr>
          <td colSpan={4} className="pt-4" />
        </tr>
        <CFRow label="Net change in funds" c={net.c} b={net.b} strong indent={0} />
        <tr className="text-[14px] font-bold text-slate-900">
          <td className="border-y-[3px] border-double border-slate-800 py-2">Closing balance</td>
          <td className="border-y-[3px] border-double border-slate-800 py-2 text-right tabular-nums">{n(closing.c)}</td>
          <td className="border-y-[3px] border-double border-slate-800 py-2 text-right tabular-nums">{n(closing.b)}</td>
          <td className="border-y-[3px] border-double border-slate-800 py-2 text-right tabular-nums">{n(closing.c + closing.b)}</td>
        </tr>
        {(closing.c !== data.closing.cash || closing.b !== data.closing.bank) && (
          <tr>
            <td colSpan={4} className="pt-2 text-[11px] text-rose-600">
              Ledger closing balance is cash {fmt(data.closing.cash)} · bank {fmt(data.closing.bank)} — check for uncategorised entries.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ------------------------------ balance sheet ------------------------------ */

export function BalanceSheet({ data, taxRate, investors }: { data: ReportData; taxRate: number; investors: Investor[] }) {
  const { assets, taxPayable, opening, capital, drawings, retained, equity, balanced } = balanceSheetFigures(data, taxRate);

  return (
    <>
      <Doc>
        <Section title="Assets" />
        <tr className="text-[12px] text-slate-500">
          <td colSpan={4} className="pb-0.5 pl-[14px] italic">
            Current assets
          </td>
        </tr>
        <L label="Cash in hand (cash box)" v={data.closing.cash} indent={2} />
        <L label="Cash at bank" v={data.closing.bank} indent={2} />
        <Total label="Total assets" v={assets} strong double />

        <Section title="Liabilities" />
        {taxRate ? (
          <L label={`Income tax payable (@ ${taxRate}% on profit to date, less tax paid)`} v={taxPayable} />
        ) : (
          <L label="No liabilities recorded" v={0} muted />
        )}
        <Total label="Total liabilities" v={taxPayable} />

        <Section title="Investors' equity" />
        <L label="Opening balances brought forward" v={opening} />
        <L label="Capital introduced" v={capital} />
        <L label={`Retained ${retained >= 0 ? "profit" : "loss"}${taxRate ? " (after tax)" : ""}`} v={retained} />
        <L label="Less: investor withdrawals" v={-drawings} />
        <Total label="Total equity" v={equity} strong />

        <tr>
          <td colSpan={4} className="pt-3" />
        </tr>
        <Total label="Total liabilities & equity" v={equity + taxPayable} strong double />
      </Doc>
      <p className={cn("mt-3 text-[11px]", balanced ? "text-teal-deep" : "text-rose-600")}>
        {balanced ? "✓ Balanced — assets equal liabilities plus equity." : "⚠ Not balanced — check entries."}
      </p>

      {investors.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-deep">Equity by investor</p>
          <table className="mt-2 w-full text-[13px]">
            <tbody>
              {investors.map((p) => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="py-1.5">{p.name}</td>
                  <td className="w-20 py-1.5 text-right tabular-nums text-slate-500">{p.sharePct}%</td>
                  <td className="w-28 py-1.5 text-right tabular-nums">{n(Math.round((equity * p.sharePct) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------ signatures ------------------------------ */

export type SignedBy = Record<string, { image: string | null; at: string }>;

/** Sign-off block. With `signed`, approved investors get their signature + date. */
export function Signatures({ investors, signed }: { investors: Pick<Investor, "id" | "name" | "sharePct">[]; signed?: SignedBy }) {
  return (
    <div className="mt-12 break-inside-avoid">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-deep">Approval</p>
      <p className="mt-1 text-[12px] text-slate-500">
        We, the investors of Cue Point, have reviewed and approve this statement.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
        {investors.map((p) => {
          const s = signed?.[p.id];
          return (
            <div key={p.id}>
              <div className="flex h-14 items-end border-b border-slate-700 pb-0.5">
                {s?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt={`${p.name} signature`} className="max-h-14 max-w-[70%] object-contain" />
                )}
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-slate-900">{p.name}</p>
              <div className="mt-0.5 flex justify-between text-[11px] text-slate-500">
                <span>Investor · {p.sharePct}%</span>
                <span>{s ? `Approved ${new Date(s.at).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" })}` : "Date: ____________"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
