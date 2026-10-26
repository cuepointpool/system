"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AccountsProvider, type Meta } from "./ui";
import { Overview } from "./Overview";
import { DayBook } from "./DayBook";
import { Ledger } from "./Ledger";
import { Reports } from "./Reports";
import { Investors } from "./Investors";
import { ChangeLog } from "./ChangeLog";

type Screen = "overview" | "day" | "ledger" | "reports" | "investors" | "log";

const SCREENS: { value: Screen; label: string; hint: string }[] = [
  { value: "overview", label: "Overview", hint: "Balances & trends" },
  { value: "day", label: "Day book", hint: "Enter the day" },
  { value: "ledger", label: "Ledger", hint: "Every entry" },
  { value: "reports", label: "Reports", hint: "P&L · cash flow · balance sheet" },
  { value: "investors", label: "Investors", hint: "Shares & access" },
  { value: "log", label: "Change log", hint: "Who edited what" },
];

/**
 * The accounting section. Used by the admin console and the investor
 * portal alike — what you may do comes from the server (`access`).
 */
export function AccountsApp({ headers = {} }: { headers?: Record<string, string> }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("overview");
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const hk = JSON.stringify(headers);
  const reloadMeta = useCallback(() => {
    fetch("/api/accounts?view=meta", { headers: JSON.parse(hk), cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? (setMeta(d), setErr(null)) : setErr(d.error || "Failed to load")))
      .catch(() => setErr("Failed to load"));
  }, [hk]);
  useEffect(() => reloadMeta(), [reloadMeta]);

  if (!meta)
    return <p className="text-sm text-mist">{err ?? "Loading accounts…"}</p>;

  const { canEdit, isAdmin } = meta.access;

  return (
    <AccountsProvider value={{ meta, headers, reloadMeta, tick, bump }}>
      <div className="accounts-app">
        <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-teal">Accounts</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">
              Cue Point books
            </h2>
            <p className="mt-1 text-xs text-mist">
              Cash box, bank and every rupee in between — entered at the end of each day.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px]",
              canEdit
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-white/15 bg-white/5 text-mist",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", canEdit ? "bg-teal" : "bg-mist")} />
            {isAdmin ? "Admin · full access" : canEdit ? "Investor · can edit" : "Investor · view only"}
          </span>
        </div>

        <nav
          className={cn(
            "no-print mt-5 grid grid-cols-2 gap-2",
            isAdmin ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-5",
          )}
        >
          {SCREENS.filter((s) => s.value !== "log" || isAdmin).map((s) => (
            <button
              key={s.value}
              onClick={() => setScreen(s.value)}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-left transition",
                screen === s.value
                  ? "border-teal/50 bg-teal/10 shadow-[0_10px_40px_-20px_rgba(0,194,168,0.9)]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25",
              )}
            >
              <span
                className={cn(
                  "block text-sm font-semibold",
                  screen === s.value ? "text-teal" : "text-white",
                )}
              >
                {s.label}
              </span>
              <span className="block truncate text-[10px] text-mist">{s.hint}</span>
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {screen === "overview" && <Overview onGo={(s) => setScreen(s)} />}
          {screen === "day" && <DayBook />}
          {screen === "ledger" && <Ledger />}
          {screen === "reports" && <Reports />}
          {screen === "investors" && <Investors />}
          {screen === "log" && isAdmin && <ChangeLog />}
        </div>
      </div>
    </AccountsProvider>
  );
}
