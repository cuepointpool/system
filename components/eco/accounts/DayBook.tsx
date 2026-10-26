"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMinutes, quoteSession, sessionMinutes } from "@/lib/playtime";
import { TimeField } from "./TimeField";
import { EditPanel } from "./EntryEdit";
import {
  EXPENSE_CATEGORIES,
  QUICK_INCOME,
  TABLE_INCOME,
  entryEffect,
} from "@/lib/accounts-categories";
import {
  Card,
  ErrorNote,
  KindBadge,
  Label,
  Money,
  PayPicker,
  Seg,
  addDays,
  entryTitle,
  fmt,
  longDate,
  shortDate,
  splitAmount,
  useAccounts,
  useSend,
  useView,
  type Balances,
  type CashDay,
  type Entry,
  type PayMode,
} from "./ui";

type StaffLogLine = {
  id: string;
  tableId: string;
  tableName: string;
  startTime: string;
  endTime: string;
  billedMin: number;
  amount: number;
  customer: string;
};

type DayData = {
  date: string;
  entries: Entry[];
  cashDay: CashDay | null;
  previousClose: CashDay | null;
  start: Balances;
  end: Balances;
  staffLog: StaffLogLine[];
};

type FormTab = "table" | "income" | "expense" | "transfer" | "investor";
type Prefill = { key: number; tableId: string; start: string; end: string; amount: number; note: string };

export function DayBook() {
  const { meta } = useAccounts();
  const [date, setDate] = useState(meta.today);
  const { data, err } = useView<DayData>({ view: "day", date });
  const [form, setForm] = useState<FormTab>("table");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const canEdit = meta.access.canEdit;

  const day = data && data.date === date ? data : null;
  const totals = day ? dayTotals(day.entries) : null;

  return (
    <div className="space-y-5">
      {/* date bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(addDays(date, -1))} className="btn-ghost h-9 w-9 text-sm" aria-label="Previous day">
            ‹
          </button>
          <div className="min-w-[190px] text-center">
            <p className="font-display text-lg font-semibold text-white">{longDate(date)}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-mist">
              {date === meta.today ? "Today" : date < meta.today ? "Past day" : "Future day"}
            </p>
          </div>
          <button onClick={() => setDate(addDays(date, 1))} className="btn-ghost h-9 w-9 text-sm" aria-label="Next day">
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="input h-9 w-40 text-xs"
          />
          {date !== meta.today && (
            <button onClick={() => setDate(meta.today)} className="btn-ghost px-3 py-2 text-xs">
              Today
            </button>
          )}
        </div>
      </div>

      {!day ? (
        <p className="text-sm text-mist">{err ?? "Loading day…"}</p>
      ) : (
        <>
          {/* day strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Strip k="Start of day" cash={day.start.cash} bank={day.start.bank} />
            <Strip k="Income" v={totals!.income} sub={`cash ${fmt(totals!.incomeCash)} · bank ${fmt(totals!.incomeBank)}`} tone="teal" />
            <Strip k="Expenses" v={totals!.expense} sub={`cash ${fmt(totals!.expenseCash)} · bank ${fmt(totals!.expenseBank)}`} tone="rose" />
            <Strip k="End of day" cash={day.end.cash} bank={day.end.bank} strong />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            {/* entry forms */}
            {canEdit ? (
              <Card className="h-fit">
                <div className="-mt-1 mb-5 overflow-x-auto">
                  <Seg
                    value={form}
                    onChange={setForm}
                    options={[
                      { value: "table", label: "🎱 Table play" },
                      { value: "income", label: "🥤 Other income" },
                      { value: "expense", label: "🧾 Expense" },
                      { value: "transfer", label: "🏦 Bank deposit" },
                      { value: "investor", label: "🤝 Investor" },
                    ]}
                  />
                </div>
                {form === "table" && <TableForm date={date} prefill={prefill} />}
                {form === "income" && <IncomeForm date={date} />}
                {form === "expense" && <ExpenseForm date={date} />}
                {form === "transfer" && <TransferForm date={date} cashOnHand={day.end.cash} />}
                {form === "investor" && <InvestorForm date={date} />}
              </Card>
            ) : (
              <Card className="h-fit" title="View only">
                <p className="text-xs text-mist">
                  You can see every entry and report. Ask the admin to enable editing for your investor login if you
                  need to record entries.
                </p>
              </Card>
            )}

            <CashBox day={day} />
          </div>

          <DayEntries entries={day.entries} />

          {day.staffLog.length > 0 && (
            <StaffLog
              lines={day.staffLog}
              entries={day.entries}
              canEdit={canEdit}
              onUse={(l) => {
                setForm("table");
                setPrefill({
                  key: Date.now(),
                  tableId: l.tableId,
                  start: l.startTime,
                  end: l.endTime,
                  amount: l.amount,
                  note: l.customer,
                });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function dayTotals(entries: Entry[]) {
  const t = { income: 0, incomeCash: 0, incomeBank: 0, expense: 0, expenseCash: 0, expenseBank: 0, cashNet: 0 };
  for (const e of entries) {
    if (e.kind === "income") {
      t.income += e.cash + e.bank;
      t.incomeCash += e.cash;
      t.incomeBank += e.bank;
    } else if (e.kind === "expense") {
      t.expense += e.cash + e.bank;
      t.expenseCash += e.cash;
      t.expenseBank += e.bank;
    }
    if (e.kind !== "opening") t.cashNet += entryEffect(e).cash;
  }
  return t;
}

function Strip({
  k,
  v,
  sub,
  cash,
  bank,
  tone,
  strong,
}: {
  k: string;
  v?: number;
  sub?: string;
  cash?: number;
  bank?: number;
  tone?: "teal" | "rose";
  strong?: boolean;
}) {
  const val = v ?? (cash ?? 0) + (bank ?? 0);
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        strong ? "border-teal/30 bg-teal/[0.07]" : "border-white/10 bg-white/[0.02]",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-mist">{k}</p>
      <Money
        v={val}
        className={cn(
          "mt-1 block font-display text-2xl font-bold",
          tone === "teal" ? "text-teal" : tone === "rose" ? "text-rose-200" : "text-white",
        )}
      />
      <p className="mt-1 text-[11px] text-mist">
        {sub ?? (
          <>
            cash <span className="text-white/80">{fmt(cash ?? 0)}</span> · bank{" "}
            <span className="text-white/80">{fmt(bank ?? 0)}</span>
          </>
        )}
      </p>
    </div>
  );
}

/* ------------------------------- forms ------------------------------- */

function Amount({
  value,
  onChange,
  label = "Amount (LKR)",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="0"
        className="input h-11 font-display text-lg font-semibold tabular-nums"
      />
    </label>
  );
}

function SubmitRow({
  busy,
  disabled,
  label,
  error,
  done,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  error: string | null;
  done: string | null;
}) {
  return (
    <div className="space-y-3">
      <ErrorNote text={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || disabled} className="btn-primary px-6 py-2.5 text-sm disabled:opacity-40">
          {busy ? "Saving…" : label}
        </button>
        {done && <span className="text-xs text-teal">✓ {done}</span>}
      </div>
    </div>
  );
}

function usePay() {
  const [mode, setMode] = useState<PayMode>("cash");
  const [cashPart, setCashPart] = useState("");
  return { mode, setMode, cashPart, setCashPart };
}

function useDone() {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 2500);
    return () => clearTimeout(t);
  }, [done]);
  return [done, setDone] as const;
}

function TableForm({ date, prefill }: { date: string; prefill: Prefill | null }) {
  const { meta } = useAccounts();
  const { send, busy, error } = useSend();
  const [tableId, setTableId] = useState(meta.tables[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [note, setNote] = useState("");
  const pay = usePay();
  const [done, setDone] = useDone();

  // staff-log "Use" fills the form
  useEffect(() => {
    if (!prefill) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTableId(prefill.tableId);
    setStart(prefill.start);
    setEnd(prefill.end);
    setPrice(String(prefill.amount));
    setPriceTouched(true);
    setNote(prefill.note);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [prefill]);

  const mins = start && end ? sessionMinutes(start, end) : null;
  const quote = mins ? quoteSession(mins) : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!priceTouched) setPrice(quote ? String(quote.gross) : "");
  }, [quote?.gross, priceTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Number(price) || 0;
  const table = meta.tables.find((t) => t.id === tableId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { cash, bank } = splitAmount(total, pay.mode, Number(pay.cashPart));
    const ok = await send("POST", {
      date,
      kind: "income",
      category: TABLE_INCOME,
      tableId,
      tableName: table?.label ?? "Table",
      startTime: start,
      endTime: end,
      minutes: mins,
      description: note,
      cash,
      bank,
    });
    if (ok) {
      setDone(`${table?.label} · LKR ${fmt(total)} added`);
      setStart(end); // next game on this table usually starts when the last ended
      setEnd("");
      setPriceTouched(false);
      setNote("");
      pay.setCashPart("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label>Table</Label>
        <div className="grid grid-cols-3 gap-2">
          {meta.tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTableId(t.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                tableId === t.id
                  ? "border-teal bg-teal/15 text-teal"
                  : "border-white/10 bg-black/20 text-white/80 hover:border-white/30",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <Label>In time</Label>
          <TimeField value={start} onChange={setStart} />
        </div>
        <div>
          <Label>Out time</Label>
          <TimeField value={end} onChange={setEnd} from={start || undefined} align="right" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Amount
            label="Price (LKR)"
            value={price}
            onChange={(v) => {
              setPrice(v);
              setPriceTouched(true);
            }}
          />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-mist">
        {mins ? (
          <>
            Played {formatMinutes(mins)} → billed {formatMinutes(quote!.billedMin)} · standard price{" "}
            <span className="text-white/85">LKR {fmt(quote!.gross)}</span>
            {priceTouched && quote!.gross !== total && (
              <button
                type="button"
                onClick={() => setPriceTouched(false)}
                className="ml-2 text-teal underline-offset-2 hover:underline"
              >
                use standard
              </button>
            )}
          </>
        ) : start && end ? (
          <span className="text-amber-200">Out time must be after in time (past midnight is fine).</span>
        ) : (
          "Enter in and out time — price fills in from the table rate, and you can change it."
        )}
      </p>
      <PayPicker
        mode={pay.mode}
        onMode={pay.setMode}
        cashPart={pay.cashPart}
        onCashPart={pay.setCashPart}
        total={total}
      />
      <label className="block">
        <Label>Note (optional)</Label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="customer, discount reason…" className="input" />
      </label>
      <SubmitRow
        busy={busy}
        disabled={!tableId || !mins || total <= 0}
        label="Add table income"
        error={error}
        done={done}
      />
    </form>
  );
}

function IncomeForm({ date }: { date: string }) {
  const { send, busy, error } = useSend();
  const [category, setCategory] = useState<string>(QUICK_INCOME[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const pay = usePay();
  const [done, setDone] = useDone();
  const total = Number(amount) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await send("POST", {
      date,
      kind: "income",
      category,
      description: note,
      ...splitAmount(total, pay.mode, Number(pay.cashPart)),
    });
    if (ok) {
      setDone(`${category} · LKR ${fmt(total)} added`);
      setAmount("");
      setNote("");
      pay.setCashPart("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label>What was sold</Label>
        <div className="flex flex-wrap gap-2">
          {QUICK_INCOME.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs transition",
                category === c ? "border-teal bg-teal/15 text-teal" : "border-white/10 text-white/80 hover:border-white/30",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Amount value={amount} onChange={setAmount} label="Day total (LKR)" />
        <label className="block">
          <Label>Note (optional)</Label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 12 bottles" className="input h-11" />
        </label>
      </div>
      <PayPicker mode={pay.mode} onMode={pay.setMode} cashPart={pay.cashPart} onCashPart={pay.setCashPart} total={total} verb="Received by" />
      <SubmitRow busy={busy} disabled={total <= 0} label={`Add ${category.toLowerCase()}`} error={error} done={done} />
    </form>
  );
}

function ExpenseForm({ date }: { date: string }) {
  const { send, busy, error, setError } = useSend();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[2].label);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const pay = usePay();
  const [done, setDone] = useDone();
  const total = Number(amount) || 0;
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 6_000_000) return setError("Receipt file is too large (max ~6MB)");
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(f);
    });
    setReceipt(url);
    setReceiptName(f.name);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await send("POST", {
      date,
      kind: "expense",
      category,
      description: note,
      receiptImage: receipt,
      ...splitAmount(total, pay.mode, Number(pay.cashPart)),
    });
    if (ok) {
      setDone(`${category} · LKR ${fmt(total)} recorded`);
      setAmount("");
      setNote("");
      setReceipt(null);
      setReceiptName("");
      pay.setCashPart("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <Label>Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input h-11">
            <optgroup label="Stock for resale (cost of sales)">
              {EXPENSE_CATEGORIES.filter((c) => c.group === "cogs").map((c) => (
                <option key={c.label}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Running costs">
              {EXPENSE_CATEGORIES.filter((c) => c.group === "opex").map((c) => (
                <option key={c.label}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Tax">
              {EXPENSE_CATEGORIES.filter((c) => c.group === "tax").map((c) => (
                <option key={c.label}>{c.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <Amount value={amount} onChange={setAmount} />
      </div>
      <label className="block">
        <Label>Description</Label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="what / who was paid" className="input" />
      </label>
      <PayPicker mode={pay.mode} onMode={pay.setMode} cashPart={pay.cashPart} onCashPart={pay.setCashPart} total={total} verb="Paid from" />
      <div>
        <Label>Receipt (optional)</Label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-3 text-xs text-mist hover:border-teal/50">
          <span>📎</span>
          <span className="truncate">{receiptName || "Attach a photo or PDF"}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
      </div>
      <SubmitRow busy={busy} disabled={total <= 0} label="Record expense" error={error} done={done} />
    </form>
  );
}

function TransferForm({ date, cashOnHand }: { date: string; cashOnHand: number }) {
  const { send, busy, error } = useSend();
  const [dir, setDir] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useDone();
  const total = Number(amount) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await send("POST", { date, kind: dir, description: note, cash: total, bank: total });
    if (ok) {
      setDone(`LKR ${fmt(total)} ${dir === "deposit" ? "deposited" : "withdrawn"}`);
      setAmount("");
      setNote("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Seg
        value={dir}
        onChange={setDir}
        options={[
          { value: "deposit", label: "Deposit cash → bank" },
          { value: "withdrawal", label: "Withdraw bank → cash" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Amount value={amount} onChange={setAmount} />
        <label className="block">
          <Label>Note (optional)</Label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="slip no., bank…" className="input h-11" />
        </label>
      </div>
      <p className="text-[11px] text-mist">
        {dir === "deposit" ? (
          <>
            Cash goes down, bank goes up — not income. Cash in hand at end of day:{" "}
            <span className="text-white/85">LKR {fmt(cashOnHand)}</span>
          </>
        ) : (
          "Bank goes down, cash goes up — not an expense."
        )}
      </p>
      <SubmitRow busy={busy} disabled={total <= 0} label={dir === "deposit" ? "Record deposit" : "Record withdrawal"} error={error} done={done} />
    </form>
  );
}

function InvestorForm({ date }: { date: string }) {
  const { meta } = useAccounts();
  const { send, busy, error } = useSend();
  const investors = meta.partners.filter((p) => p.active);
  const [kind, setKind] = useState<"capital" | "drawing">("capital");
  const [partnerId, setPartnerId] = useState(investors[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const pay = usePay();
  const [done, setDone] = useDone();
  const total = Number(amount) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await send("POST", {
      date,
      kind,
      partnerId,
      category: kind === "capital" ? "Capital introduced" : "Investor withdrawal",
      description: note,
      ...splitAmount(total, pay.mode, Number(pay.cashPart)),
    });
    if (ok) {
      setDone(`LKR ${fmt(total)} recorded`);
      setAmount("");
      setNote("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Seg
        value={kind}
        onChange={setKind}
        options={[
          { value: "capital", label: "Money put in" },
          { value: "drawing", label: "Money taken out" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <Label>Investor</Label>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="input h-11">
            {investors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Amount value={amount} onChange={setAmount} />
      </div>
      <label className="block">
        <Label>Note (optional)</Label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
      </label>
      <PayPicker
        mode={pay.mode}
        onMode={pay.setMode}
        cashPart={pay.cashPart}
        onCashPart={pay.setCashPart}
        total={total}
        verb={kind === "capital" ? "Paid into" : "Paid out of"}
      />
      <p className="text-[11px] text-mist">
        Capital and withdrawals change the investors&apos; equity on the balance sheet — they are not income or expenses.
        Ownership shares are set on the Investors screen.
      </p>
      <SubmitRow busy={busy} disabled={total <= 0 || !partnerId} label="Record" error={error} done={done} />
    </form>
  );
}

/* ------------------------------ cash box ------------------------------ */

function CashBox({ day }: { day: DayData }) {
  const { meta } = useAccounts();
  const canEdit = meta.access.canEdit;
  const { send, busy, error } = useSend();
  const suggestedOpen = day.cashDay?.opening ?? day.previousClose?.closing ?? day.start.cash;
  const [open, setOpen] = useState(String(suggestedOpen));
  const [close, setClose] = useState(day.cashDay?.closing != null ? String(day.cashDay.closing) : "");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOpen(String(day.cashDay?.opening ?? day.previousClose?.closing ?? day.start.cash));
    setClose(day.cashDay?.closing != null ? String(day.cashDay.closing) : "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [day.date, day.cashDay?.opening, day.cashDay?.closing, day.previousClose?.closing, day.start.cash]);

  const t = dayTotals(day.entries);
  const opening = day.cashDay?.opening ?? null;
  const base = opening ?? day.start.cash;
  const expected = base + t.cashNet;
  const counted = day.cashDay?.closing ?? null;
  const variance = counted == null ? null : counted - expected;
  const status = counted != null ? "Closed" : opening != null ? "Open" : "Not opened";

  return (
    <Card
      className="h-fit"
      title="Cash box"
      sub="Count the drawer when you open and when you close."
      action={
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-medium",
            status === "Closed"
              ? "bg-teal/15 text-teal"
              : status === "Open"
                ? "bg-amber-400/15 text-amber-200"
                : "bg-white/10 text-mist",
          )}
        >
          {status}
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Opening balance</Label>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              disabled={!canEdit}
              value={open}
              onChange={(e) => setOpen(e.target.value.replace(/[^\d]/g, ""))}
              className="input h-10 tabular-nums"
            />
            {canEdit && (
              <button
                disabled={busy || open === ""}
                onClick={() => send("POST", { action: "cashbox", phase: "open", date: day.date, amount: Number(open) })}
                className="btn-ghost shrink-0 px-4 text-xs disabled:opacity-40"
              >
                {opening == null ? "Open day" : "Update"}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-mist">
            {day.previousClose
              ? `Last close: LKR ${fmt(day.previousClose.closing ?? 0)} on ${shortDate(day.previousClose.date)}`
              : "No earlier close recorded."}
            {opening != null && opening !== day.start.cash && !day.entries.some((e) => e.kind === "opening") && (
              <span className="text-amber-200"> · books say LKR {fmt(day.start.cash)}</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3.5 text-xs">
          <Row k={opening != null ? "Opening (counted)" : "Opening (books)"} v={base} />
          <Row k="+ Cash income" v={t.incomeCash} />
          <Row k="− Cash expenses" v={-t.expenseCash} />
          <Row k="± Deposits, withdrawals, investors" v={t.cashNet - t.incomeCash + t.expenseCash} />
          <div className="mt-2 border-t border-white/10 pt-2">
            <Row k="Expected in box" v={expected} strong />
          </div>
        </div>

        <div>
          <Label>Closing balance (counted)</Label>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              disabled={!canEdit}
              value={close}
              onChange={(e) => setClose(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={String(expected)}
              className="input h-10 tabular-nums"
            />
            {canEdit && (
              <button
                disabled={busy || close === ""}
                onClick={() => send("POST", { action: "cashbox", phase: "close", date: day.date, amount: Number(close) })}
                className="btn-primary shrink-0 px-4 text-xs disabled:opacity-40"
              >
                {counted == null ? "Close day" : "Update"}
              </button>
            )}
          </div>
        </div>

        {variance != null && (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs",
              variance === 0
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-amber-300/30 bg-amber-400/10 text-amber-100",
            )}
          >
            {variance === 0 ? (
              "✓ Cash box matches the books."
            ) : (
              <>
                <p>
                  Cash box is <b>{variance > 0 ? "over" : "short"}</b> by LKR {fmt(Math.abs(variance))}.
                </p>
                {canEdit && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      send("POST", {
                        date: day.date,
                        kind: variance > 0 ? "income" : "expense",
                        category: variance > 0 ? "Cash over (till)" : "Cash short (till)",
                        description: "Cash box count difference",
                        cash: Math.abs(variance),
                      })
                    }
                    className="mt-2 underline underline-offset-2"
                  >
                    Record the difference so the books match the count
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <ErrorNote text={error} />
      </div>
    </Card>
  );
}

function Row({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={strong ? "font-medium text-white" : "text-mist"}>{k}</span>
      <Money v={v} tag={false} className={strong ? "font-display text-base font-bold text-white" : "text-white/85"} />
    </div>
  );
}

/* ------------------------------ entries ------------------------------ */

function DayEntries({ entries }: { entries: Entry[] }) {
  const { meta } = useAccounts();
  const canEdit = meta.access.canEdit;
  const [editing, setEditing] = useState<string | null>(null);
  const sum = entries.reduce(
    (s, e) => {
      const f = entryEffect(e);
      return { cash: s.cash + f.cash, bank: s.bank + f.bank };
    },
    { cash: 0, bank: 0 },
  );

  return (
    <Card title="Entries for the day" sub={`${entries.length} ${entries.length === 1 ? "entry" : "entries"} · amounts show the effect on each account`}>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-mist">Nothing recorded for this day yet.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-mist">
              <tr className="border-b border-white/10">
                <th className="px-5 py-2 font-medium sm:px-6">Entry</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Cash</th>
                <th className="px-3 py-2 text-right font-medium">Bank</th>
                {canEdit && <th className="w-28 px-5 py-2 sm:px-6" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {entries.map((e) =>
                editing === e.id ? (
                  <EditPanel key={e.id} e={e} colSpan={canEdit ? 5 : 4} onDone={() => setEditing(null)} />
                ) : (
                  <EntryRow key={e.id} e={e} canEdit={canEdit} onEdit={() => setEditing(e.id)} />
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/15 text-xs">
                <td className="px-5 py-2.5 font-medium text-white sm:px-6" colSpan={2}>
                  Day movement
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Money v={sum.cash} tag={false} signed className="font-semibold" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Money v={sum.bank} tag={false} signed className="font-semibold" />
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function EntryRow({ e, canEdit, onEdit }: { e: Entry; canEdit: boolean; onEdit: () => void }) {
  const { send, busy } = useSend();
  const f = entryEffect(e);
  return (
    <tr className="text-white/90">
      <td className="px-5 py-2.5 sm:px-6">
        <p className="font-medium">{entryTitle(e)}</p>
        <p className="text-[11px] text-mist">
          {e.category}
          {e.minutes ? ` · ${formatMinutes(e.minutes)}` : ""}
          {e.description && e.description !== entryTitle(e) ? ` · ${e.description}` : ""}
          {e.hasReceipt && (
            <>
              {" · "}
              <a href={`/api/accounts/receipt?id=${e.id}`} target="_blank" rel="noreferrer" className="text-teal underline-offset-2 hover:underline">
                receipt
              </a>
            </>
          )}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <KindBadge kind={e.kind} />
      </td>
      <td className="px-3 py-2.5 text-right">{f.cash ? <Money v={f.cash} tag={false} signed /> : <span className="text-mist/40">—</span>}</td>
      <td className="px-3 py-2.5 text-right">{f.bank ? <Money v={f.bank} tag={false} signed /> : <span className="text-mist/40">—</span>}</td>
      {canEdit && (
        <td className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] sm:px-6">
          <button onClick={onEdit} className="text-mist hover:text-white">
            Edit
          </button>
          <button
            disabled={busy}
            onClick={() => confirm(`Delete "${entryTitle(e)}"?`) && send("DELETE", { id: e.id })}
            className="ml-3 text-rose-300/80 hover:text-rose-200"
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  );
}

/* ------------------------------ staff log ------------------------------ */

function StaffLog({
  lines,
  entries,
  canEdit,
  onUse,
}: {
  lines: StaffLogLine[];
  entries: Entry[];
  canEdit: boolean;
  onUse: (l: StaffLogLine) => void;
}) {
  const logged = lines.reduce((s, l) => s + l.amount, 0);
  const entered = entries
    .filter((e) => e.kind === "income" && e.category === TABLE_INCOME)
    .reduce((s, e) => s + e.cash + e.bank, 0);
  const isIn = (l: StaffLogLine) =>
    entries.some((e) => e.tableId === l.tableId && e.startTime === l.startTime && e.endTime === l.endTime);

  return (
    <Card
      title="Staff play log for this day"
      sub={`Counter staff logged LKR ${fmt(logged)} of table play · entered in the books: LKR ${fmt(entered)}`}
    >
      <ul className="divide-y divide-white/[0.06] text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <span className="w-20 shrink-0 font-medium text-white/90">{l.tableName}</span>
            <span className="text-xs text-mist">
              {l.startTime}–{l.endTime} · {formatMinutes(l.billedMin)}
              {l.customer ? ` · ${l.customer}` : ""}
            </span>
            <Money v={l.amount} className="ml-auto text-xs" />
            {isIn(l) ? (
              <span className="w-14 text-right text-[11px] text-teal">✓ in</span>
            ) : canEdit ? (
              <button onClick={() => onUse(l)} className="w-14 text-right text-[11px] text-teal hover:underline">
                Use →
              </button>
            ) : (
              <span className="w-14" />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
