"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type EntryKind } from "@/lib/accounts-categories";

/* ---------------------------------- types --------------------------------- */

export type Balances = { cash: number; bank: number };

export type Entry = {
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
};

export type Investor = {
  id: string;
  name: string;
  active: boolean;
  username: string | null;
  positions: string[];
  sharePct: number;
  canEditAccounts: boolean;
  hasLogin: boolean;
  hasSignature: boolean;
};

export type CashDay = {
  date: string;
  opening: number | null;
  closing: number | null;
  openingNote: string;
  closingNote: string;
};

export type Meta = {
  today: string;
  access: {
    isAdmin: boolean;
    canEdit: boolean;
    /** the signed-in investor; null for admins */
    partnerId: string | null;
    canSubmitStatements: boolean;
  };
  partners: Investor[];
  tables: { id: string; label: string }[];
};

/* --------------------------------- context -------------------------------- */

type Ctx = {
  meta: Meta;
  headers: Record<string, string>;
  reloadMeta: () => void;
  /** bumps after any write so every screen refetches */
  tick: number;
  bump: () => void;
};
const AccountsCtx = createContext<Ctx | null>(null);
export const AccountsProvider = AccountsCtx.Provider;
export function useAccounts(): Ctx {
  const c = useContext(AccountsCtx);
  if (!c) throw new Error("useAccounts outside AccountsProvider");
  return c;
}

/** GET /api/accounts?view=… — refetches when the query or tick changes. */
export function useView<T>(params: Record<string, string> | null) {
  const { headers, tick } = useAccounts();
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const qs = params ? new URLSearchParams(params).toString() : null;
  const hk = JSON.stringify(headers);
  useEffect(() => {
    if (qs === null) return;
    let live = true;
    fetch(`/api/accounts?${qs}`, { headers: JSON.parse(hk), cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!live) return;
        if (ok) {
          setData(d);
          setErr(null);
        } else setErr(d.error || "Failed to load");
      })
      .catch(() => live && setErr("Failed to load"));
    return () => {
      live = false;
    };
  }, [qs, hk, tick]);
  return { data, err };
}

/** POST / PATCH / DELETE against /api/accounts, then refresh every screen. */
export function useSend() {
  const { headers, bump } = useAccounts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useCallback(
    async (method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res =
          method === "DELETE"
            ? await fetch(`/api/accounts?id=${encodeURIComponent(String(payload.id))}`, {
                method,
                headers,
              })
            : await fetch("/api/accounts", {
                method,
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not save");
        bump();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [headers, bump],
  );
  return { send, busy, error, setError };
}

/* --------------------------------- format --------------------------------- */

export const fmt = (n: number) => (Math.round(n) || 0).toLocaleString("en-LK"); // || 0 drops "-0"

/** "LKR 12,500" with a quiet currency tag. Negative shows as (12,500). */
export function Money({
  v,
  className,
  tag = true,
  signed = false,
}: {
  v: number;
  className?: string;
  tag?: boolean;
  signed?: boolean;
}) {
  v = Math.round(v) || 0;
  const neg = v < 0;
  return (
    <span className={cn("tabular-nums", neg && "text-rose-300", className)}>
      {tag && <span className="mr-1 text-[0.7em] font-normal text-mist/70">LKR</span>}
      {neg ? `(${fmt(-v)})` : `${signed && v > 0 ? "+" : ""}${fmt(v)}`}
    </span>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 2026-10-25 → "Sun, 25 Oct 2026" */
export function longDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${DAYS[wd]}, ${day} ${MONTHS[m - 1]} ${y}`;
}
/** 2026-10-25 → "25 Oct" */
export function shortDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}`;
}
export function addDays(d: string, n: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
}

/* -------------------------------- building -------------------------------- */

export function Card({
  title,
  sub,
  action,
  children,
  className,
}: {
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-5 sm:p-6",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-display text-base font-semibold text-white">{title}</h3>}
            {sub && <p className="mt-0.5 text-xs text-mist">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-medium transition",
            size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-xs",
            value === o.value
              ? "bg-teal text-navy-950 shadow-[0_6px_20px_-8px_rgba(0,194,168,0.9)]"
              : "text-mist hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2.5 text-xs text-white/85",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition",
          on ? "border-teal bg-teal" : "border-white/20 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-mist">{children}</span>;
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
      {text}
    </p>
  );
}

/* ------------------------------ cash / bank pick ------------------------------ */

export type PayMode = "cash" | "bank" | "split";

/** Turn a total + payment mode (+ cash part when split) into cash/bank amounts. */
export function splitAmount(total: number, mode: PayMode, cashPart: number) {
  const t = Math.max(0, Math.round(total) || 0);
  if (mode === "cash") return { cash: t, bank: 0 };
  if (mode === "bank") return { cash: 0, bank: t };
  const c = Math.min(t, Math.max(0, Math.round(cashPart) || 0));
  return { cash: c, bank: t - c };
}

export function PayPicker({
  mode,
  onMode,
  cashPart,
  onCashPart,
  total,
  verb = "Paid by",
}: {
  mode: PayMode;
  onMode: (m: PayMode) => void;
  cashPart: string;
  onCashPart: (v: string) => void;
  total: number;
  verb?: string;
}) {
  const s = splitAmount(total, mode, Number(cashPart));
  return (
    <div>
      <Label>{verb}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          value={mode}
          onChange={(m) => {
            onMode(m);
            if (m === "split" && !cashPart && total) onCashPart(String(Math.round(total / 2)));
          }}
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank", label: "Bank" },
            { value: "split", label: "Cash + Bank" },
          ]}
        />
        {mode === "split" && (
          <div className="flex items-center gap-2 text-xs">
            <input
              inputMode="numeric"
              value={cashPart}
              onChange={(e) => onCashPart(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="cash part"
              className="input h-8 w-28 text-xs"
            />
            <span className="whitespace-nowrap text-mist">
              cash + <span className="text-white/90 tabular-nums">{fmt(s.bank)}</span> bank
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- badges --------------------------------- */

const KIND_TONE: Record<EntryKind, string> = {
  opening: "bg-sky-400/10 text-sky-200 border-sky-300/20",
  income: "bg-teal/10 text-teal border-teal/25",
  expense: "bg-rose-400/10 text-rose-200 border-rose-300/20",
  deposit: "bg-indigo-400/10 text-indigo-200 border-indigo-300/20",
  withdrawal: "bg-amber-400/10 text-amber-200 border-amber-300/20",
  capital: "bg-violet-400/10 text-violet-200 border-violet-300/20",
  drawing: "bg-orange-400/10 text-orange-200 border-orange-300/20",
};

export function KindBadge({ kind }: { kind: EntryKind }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
        KIND_TONE[kind],
      )}
    >
      {KIND_LABELS[kind]}
    </span>
  );
}

/** Where the money went: "Cash", "Bank" or "Cash 500 · Bank 300"; transfers show the direction. */
export function ViaLabel({ e }: { e: Pick<Entry, "kind" | "cash" | "bank"> }) {
  if (e.kind === "deposit") return <span className="text-mist">Cash → Bank</span>;
  if (e.kind === "withdrawal") return <span className="text-mist">Bank → Cash</span>;
  if (e.cash && e.bank)
    return (
      <span className="text-mist">
        Cash {fmt(e.cash)} · Bank {fmt(e.bank)}
      </span>
    );
  return <span className="text-mist">{e.cash ? "Cash" : "Bank"}</span>;
}

/** Total moved by an entry (transfers count once). */
export const entryAmount = (e: Pick<Entry, "kind" | "cash" | "bank">) =>
  e.kind === "deposit" || e.kind === "withdrawal" ? e.cash : e.cash + e.bank;

export function entryTitle(e: Entry): string {
  if (e.kind === "income" && e.tableName)
    return `${e.tableName}${e.startTime && e.endTime ? ` · ${e.startTime}–${e.endTime}` : ""}`;
  if (e.kind === "deposit") return "Cash deposited to bank";
  if (e.kind === "withdrawal") return "Cash withdrawn from bank";
  if ((e.kind === "capital" || e.kind === "drawing") && e.partnerName) return e.partnerName;
  return e.description || e.category || KIND_LABELS[e.kind];
}
