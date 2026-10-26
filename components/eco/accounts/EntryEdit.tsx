"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { sessionMinutes } from "@/lib/playtime";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, KIND_LABELS, TABLE_INCOME } from "@/lib/accounts-categories";
import { TimeField } from "./TimeField";
import { ErrorNote, Label, PayPicker, splitAmount, useAccounts, useSend, type Entry, type PayMode } from "./ui";

/**
 * Correct an entry in place: date, category, table + times, amount and how
 * it was paid. Every save is written to the change log (admin-only view).
 * Renders as a full-width table row under the entry being edited.
 */
export function EditPanel({ e, colSpan, onDone }: { e: Entry; colSpan: number; onDone: () => void }) {
  const { meta } = useAccounts();
  const { send, busy, error } = useSend();
  const transfer = e.kind === "deposit" || e.kind === "withdrawal";
  const isTable = e.kind === "income" && e.category === TABLE_INCOME;

  const [date, setDate] = useState(e.date);
  const [category, setCategory] = useState(e.category);
  const [description, setDescription] = useState(e.description);
  const [tableId, setTableId] = useState(e.tableId ?? meta.tables[0]?.id ?? "");
  const [start, setStart] = useState(e.startTime ?? "");
  const [end, setEnd] = useState(e.endTime ?? "");
  const [partnerId, setPartnerId] = useState(e.partnerId ?? "");
  const [amount, setAmount] = useState(String(transfer ? e.cash : e.cash + e.bank));
  const [mode, setMode] = useState<PayMode>(e.cash && e.bank ? "split" : e.bank ? "bank" : "cash");
  const [cashPart, setCashPart] = useState(e.cash && e.bank ? String(e.cash) : "");

  const total = Number(amount) || 0;
  const mins = isTable && start && end ? sessionMinutes(start, end) : null;
  const categories =
    e.kind === "income"
      ? [...INCOME_CATEGORIES]
      : e.kind === "expense"
        ? EXPENSE_CATEGORIES.map((c) => c.label)
        : [];
  if (category && categories.length && !categories.includes(category)) categories.unshift(category);

  const save = async () => {
    const money = transfer ? { cash: total, bank: total } : splitAmount(total, mode, Number(cashPart));
    const patch: Record<string, unknown> = { id: e.id, date, description, ...money };
    if (categories.length) patch.category = category;
    if (isTable) {
      const table = meta.tables.find((t) => t.id === tableId);
      Object.assign(patch, { tableId, tableName: table?.label ?? e.tableName, startTime: start, endTime: end, minutes: mins });
    }
    if (e.kind === "capital" || e.kind === "drawing") patch.partnerId = partnerId;
    if (await send("PATCH", patch)) onDone();
  };

  return (
    <tr className="bg-teal/[0.05]">
      <td colSpan={colSpan} className="px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Edit {KIND_LABELS[e.kind].toLowerCase()}</p>
          <p className="text-[10px] text-mist">Changes are recorded in the admin change log.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <Label>Date</Label>
            <input type="date" value={date} onChange={(ev) => ev.target.value && setDate(ev.target.value)} className="input h-10 text-sm" />
          </label>
          {categories.length > 0 && (
            <label className="block">
              <Label>Category</Label>
              <select value={category} onChange={(ev) => setCategory(ev.target.value)} className="input h-10 text-sm">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {(e.kind === "capital" || e.kind === "drawing") && (
            <label className="block">
              <Label>Investor</Label>
              <select value={partnerId} onChange={(ev) => setPartnerId(ev.target.value)} className="input h-10 text-sm">
                {meta.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <Label>{transfer ? "Amount moved (LKR)" : "Amount (LKR)"}</Label>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value.replace(/[^\d]/g, ""))}
              className="input h-10 font-semibold tabular-nums"
            />
          </label>
        </div>

        {isTable && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Table</Label>
              <div className="flex gap-1.5">
                {meta.tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTableId(t.id)}
                    title={t.label}
                    className={cn(
                      "h-10 flex-1 truncate rounded-lg border px-2 text-xs font-semibold",
                      tableId === t.id ? "border-teal bg-teal/15 text-teal" : "border-white/10 text-white/80",
                    )}
                  >
                    {t.label.split(" — ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>In time</Label>
              <TimeField value={start} onChange={setStart} />
            </div>
            <div>
              <Label>Out time</Label>
              <TimeField value={end} onChange={setEnd} from={start || undefined} align="right" />
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
          {!transfer && (
            <PayPicker
              mode={mode}
              onMode={setMode}
              cashPart={cashPart}
              onCashPart={setCashPart}
              total={total}
              verb={e.kind === "expense" || e.kind === "drawing" ? "Paid from" : "Paid by"}
            />
          )}
          <label className="block">
            <Label>Note</Label>
            <input value={description} onChange={(ev) => setDescription(ev.target.value)} className="input h-10 text-sm" />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <ErrorNote text={error} />
          <div className="flex items-center gap-3">
            <button
              disabled={busy || total <= 0 || (isTable && !mins)}
              onClick={save}
              className="btn-primary px-5 py-2 text-xs disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button onClick={onDone} className="btn-ghost px-4 py-2 text-xs">
              Cancel
            </button>
            {isTable && start && end && !mins && <span className="text-[11px] text-amber-200">Out time must be after in time.</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}
