"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/config";
import { ENTRY_KINDS, KIND_LABELS, entryEffect } from "@/lib/accounts-categories";
import {
  Card,
  Seg,
  addDays,
  entryTitle,
  fmt,
  useAccounts,
  useSend,
  useView,
  type Balances,
  type Entry,
} from "./ui";
import { EditPanel } from "./EntryEdit";

type Book = "cash" | "bank" | "all";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-10-25 → "25 Oct 2026" */
const ledgerDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
};

/** Debit (money in) and credit (money out) of one entry in the chosen book. */
function drCr(e: Entry, book: Book): { dr: number; cr: number } {
  const f = entryEffect(e);
  const parts = book === "cash" ? [f.cash] : book === "bank" ? [f.bank] : [f.cash, f.bank];
  return {
    dr: parts.reduce((s, v) => s + Math.max(0, v), 0),
    cr: parts.reduce((s, v) => s + Math.max(0, -v), 0),
  };
}

const openingOf = (o: Balances, book: Book) => (book === "cash" ? o.cash : book === "bank" ? o.bank : o.cash + o.bank);

/** Ledger balance: "12,500 Dr", or "1,200 Cr" in red when overdrawn. */
function Bal({ v }: { v: number }) {
  v = Math.round(v) || 0;
  return (
    <span className={cn("tabular-nums", v < 0 ? "text-red-700" : "text-gray-900")}>
      {fmt(Math.abs(v))}
      <span className="ml-1 text-[10px] font-semibold text-gray-500">{v < 0 ? "Cr" : "Dr"}</span>
    </span>
  );
}

export function Ledger() {
  const { meta } = useAccounts();
  const [book, setBook] = useState<Book>("all");
  const [from, setFrom] = useState(addDays(meta.today, -30));
  const [to, setTo] = useState(meta.today);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const params: Record<string, string> = { view: "ledger", from, to };
  if (kind) params.kind = kind;
  const { data, err } = useView<{ entries: Entry[]; opening: Balances }>(params);
  const canEdit = meta.access.canEdit;
  const [editing, setEditing] = useState<string | null>(null);
  const { send, busy } = useSend();
  // a running balance only adds up over the unfiltered book
  const filtered = !!kind || !!q.trim();
  const cols = 5 + (filtered ? 0 : 1) + (canEdit ? 1 : 0);

  const { rows, opening, split, totals } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...(data?.entries ?? [])]
      // ledgers read oldest first
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .filter((e) => {
        const { dr, cr } = drCr(e, book);
        if (!dr && !cr) return false;
        if (!needle) return true;
        return [entryTitle(e), e.category, e.description, e.tableName ?? "", e.partnerName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
    const opening = data ? openingOf(data.opening, book) : 0;
    let bal = opening;
    let dr = 0;
    let cr = 0;
    const rows: { e: Entry; dr: number; cr: number; bal: number }[] = [];
    for (const e of list) {
      const x = drCr(e, book);
      bal += x.dr - x.cr;
      dr += x.dr;
      cr += x.cr;
      rows.push({ e, ...x, bal });
    }
    // per-account split for the combined view's summary
    const split = { open: data?.opening ?? { cash: 0, bank: 0 }, close: { ...(data?.opening ?? { cash: 0, bank: 0 }) } };
    for (const { e } of rows) {
      const f = entryEffect(e);
      split.close.cash += f.cash;
      split.close.bank += f.bank;
    }
    return { rows, opening, split, totals: { dr, cr, closing: bal } };
  }, [data, q, book]);

  const exportCsv = () => {
    const head = ["Date", "Particulars", "Type", "Category", "Description", "Debit", "Credit"];
    if (!filtered) head.push("Balance");
    const lines: (string | number)[][] = [];
    if (!filtered) lines.push([from, "Balance brought forward", "", "", "", "", "", opening]);
    for (const r of rows) {
      const line: (string | number)[] = [
        r.e.date,
        entryTitle(r.e),
        KIND_LABELS[r.e.kind],
        r.e.category,
        r.e.description,
        r.dr || "",
        r.cr || "",
      ];
      if (!filtered) line.push(r.bal);
      lines.push(line);
    }
    lines.push(["", "Totals", "", "", "", totals.dr, totals.cr]);
    if (!filtered) lines.push([to, "Balance carried forward", "", "", "", "", "", totals.closing]);
    const csv = [head, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `cue-point-${book === "all" ? "ledger" : `${book}-book`}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const editingEntry = editing ? rows.find((r) => r.e.id === editing)?.e : undefined;
  const sheetTitle = book === "all" ? "Cash & Bank Ledger" : book === "cash" ? "Cash Book" : "Bank Book";

  // printed-sheet styles: black figures, grey rules
  const th = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600";
  const num = "w-32 whitespace-nowrap px-3 text-right tabular-nums";
  const rule = "border-l border-gray-200";
  const balCol = "border-l border-gray-300";

  return (
    <Card
      title="Ledger"
      sub="Standard ledger with debits, credits and a running balance."
      action={
        <button onClick={exportCsv} disabled={!rows.length} className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-40">
          Export CSV
        </button>
      }
    >
      <div className="mb-4">
        <Seg
          size="sm"
          value={book}
          onChange={setBook}
          options={[
            { value: "all", label: "Combined" },
            { value: "cash", label: "Cash book" },
            { value: "bank", label: "Bank book" },
          ]}
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="input h-9 text-xs" aria-label="From" />
        <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="input h-9 text-xs" aria-label="To" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input h-9 text-xs">
          <option value="">All types</option>
          {ENTRY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input h-9 text-xs" />
      </div>

      {/* the edit form keeps the console's dark styling, above the sheet */}
      {editingEntry && (
        <div className="mb-4 overflow-hidden rounded-xl border border-teal/30">
          <table className="w-full">
            <tbody>
              <EditPanel e={editingEntry} colSpan={1} onDone={() => setEditing(null)} />
            </tbody>
          </table>
        </div>
      )}

      {!data ? (
        <p className="text-sm text-mist">{err ?? "Loading…"}</p>
      ) : (
        <div className="rounded-lg bg-white p-4 text-gray-900 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] sm:p-6">
          {/* statement heading */}
          <div className="mb-4 border-b-2 border-gray-900 pb-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">{SITE.name}</p>
            <h4 className="mt-1 font-serif text-xl font-bold text-gray-900">{sheetTitle}</h4>
            <p className="mt-0.5 text-xs text-gray-600">
              For the period {ledgerDate(from)} to {ledgerDate(to)} · Amounts in LKR
            </p>
          </div>

          {/* summary */}
          <div className="mb-4 grid grid-cols-2 border border-gray-300 md:grid-cols-4">
            {[
              { k: "Opening balance", v: filtered ? null : opening, b: split.open },
              { k: "Total debits", v: totals.dr, b: null },
              { k: "Total credits", v: totals.cr, b: null },
              { k: "Closing balance", v: filtered ? null : totals.closing, b: split.close },
            ].map((s, i) => (
              <div
                key={s.k}
                className={cn(
                  "border-gray-300 px-3 py-2.5",
                  i % 2 === 1 && "border-l",
                  i === 2 && "md:border-l",
                  i > 1 && "border-t md:border-t-0",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{s.k}</p>
                <p className="mt-0.5 text-sm font-bold">
                  {s.v === null ? (
                    <span className="font-normal text-gray-400">—</span>
                  ) : s.b ? (
                    <Bal v={s.v} />
                  ) : (
                    <span className="tabular-nums">{fmt(s.v)}</span>
                  )}
                </p>
                {book === "all" && s.b && s.v !== null && (
                  <p className="mt-0.5 text-[10px] tabular-nums text-gray-500">
                    Cash {fmt(s.b.cash)} · Bank {fmt(s.b.bank)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {filtered && (
            <p className="mb-3 text-[11px] italic text-gray-500">Running balance is hidden while a type filter or search is applied.</p>
          )}

          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-y-2 border-gray-900 bg-gray-100">
                  <th className={cn(th, "w-28")}>Date</th>
                  <th className={th}>Particulars</th>
                  <th className={cn(th, "w-32")}>Type</th>
                  <th className={cn(th, num, rule)}>Debit</th>
                  <th className={cn(th, num, rule)}>Credit</th>
                  {!filtered && <th className={cn(th, num, balCol)}>Balance</th>}
                  {canEdit && <th className={cn(th, "w-24")} />}
                </tr>
              </thead>
              <tbody>
                {!filtered && (
                  <tr className="border-b border-gray-200">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">{ledgerDate(from)}</td>
                    <td colSpan={2} className="px-3 py-2 font-semibold italic">
                      Balance brought forward (b/f)
                    </td>
                    <td className={rule} />
                    <td className={rule} />
                    <td className={cn(num, balCol, "py-2 font-semibold")}>
                      <Bal v={opening} />
                    </td>
                    {canEdit && <td />}
                  </tr>
                )}
                {rows.map(({ e, dr, cr, bal }, i) => {
                  const newDay = i === 0 || rows[i - 1].e.date !== e.date;
                  const name = entryTitle(e);
                  return (
                    <tr
                      key={e.id}
                      className={cn(
                        "align-top transition-colors",
                        newDay && i > 0 ? "border-t border-gray-300" : "border-t border-gray-100",
                        editing === e.id ? "bg-amber-100" : "hover:bg-amber-50",
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">{newDay ? ledgerDate(e.date) : ""}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium leading-snug text-gray-900">{name}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {e.category}
                          {e.description && e.description !== name ? ` · ${e.description}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{KIND_LABELS[e.kind]}</td>
                      <td className={cn(num, rule, "py-2")}>{dr ? fmt(dr) : ""}</td>
                      <td className={cn(num, rule, "py-2")}>{cr ? fmt(cr) : ""}</td>
                      {!filtered && (
                        <td className={cn(num, balCol, "py-2")}>
                          <Bal v={bal} />
                        </td>
                      )}
                      {canEdit && (
                        <td className="whitespace-nowrap px-3 py-2 text-right text-[11px]">
                          <button onClick={() => setEditing(e.id)} className="font-medium text-blue-700 hover:underline">
                            Edit
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => confirm(`Delete "${name}"?`) && send("DELETE", { id: e.id })}
                            className="ml-3 font-medium text-red-700 hover:underline disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr className="border-t border-gray-200">
                    <td colSpan={cols} className="px-6 py-8 text-center text-sm italic text-gray-500">
                      No entries in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td colSpan={3} className="px-3 py-2 font-bold uppercase tracking-wide">
                    Totals
                    <span className="ml-1.5 text-[11px] font-normal normal-case tracking-normal text-gray-500">
                      ({rows.length} {rows.length === 1 ? "entry" : "entries"})
                    </span>
                  </td>
                  <td className={cn(num, rule, "py-2 font-bold")}>{fmt(totals.dr)}</td>
                  <td className={cn(num, rule, "py-2 font-bold")}>{fmt(totals.cr)}</td>
                  {!filtered && <td className={balCol} />}
                  {canEdit && <td />}
                </tr>
                {!filtered && (
                  <tr className="border-y-4 border-double border-gray-900 bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-gray-700">{ledgerDate(to)}</td>
                    <td colSpan={2} className="px-3 py-2.5 font-bold italic">
                      Balance carried forward (c/f)
                    </td>
                    <td className={rule} />
                    <td className={rule} />
                    <td className={cn(num, balCol, "py-2.5 text-sm font-bold")}>
                      <Bal v={totals.closing} />
                    </td>
                    {canEdit && <td />}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-gray-500">
            Dr = debit balance (money held) · Cr = credit balance (overdrawn, shown in red).
          </p>
        </div>
      )}
    </Card>
  );
}
