"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FinanceTab } from "./AdminConsole";
import { cn } from "@/lib/utils";

type Me = {
  name: string;
  username: string | null;
  positions: string[];
  canEditFinance: boolean;
};

const LABELS: Record<string, string> = {
  director: "Director",
  it_admin: "IT Admin",
  secretary: "Secretary",
  marketing: "Marketing",
  treasurer: "Treasurer",
};

export function PartnerPortal() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const load = useCallback(() => {
    fetch("/api/partner/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.partner ?? null))
      .catch(() => setMe(null));
  }, []);
  useEffect(() => load(), [load]);

  const logout = async () => {
    await fetch("/api/partner/logout", { method: "POST" }).catch(() => {});
    setMe(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-teal">
            Cue Point · partners
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Partner portal
          </h1>
          <p className="mt-1.5 text-sm text-mist">
            The business finance picture — capital, ownership, expenses and daily
            cash.{" "}
            {me
              ? me.canEditFinance
                ? "You can record entries."
                : "Read-only for your positions."
              : "Sign in with the username your admin gave you."}
          </p>
        </div>
        {me && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-white/90">{me.name}</p>
              <p className="flex flex-wrap justify-end gap-1">
                {me.positions.length ? (
                  me.positions.map((p) => (
                    <span
                      key={p}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        p === "treasurer"
                          ? "bg-teal/15 text-teal"
                          : "bg-white/10 text-mist",
                      )}
                    >
                      {LABELS[p] ?? p}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-mist">no positions</span>
                )}
              </p>
            </div>
            <button onClick={logout} className="btn-ghost px-4 py-2 text-xs">
              Log out
            </button>
          </div>
        )}
      </div>

      <div className="mt-8">
        {me === undefined && (
          <p className="text-sm text-mist">Loading…</p>
        )}
        {me === null && <PartnerLogin onDone={load} />}
        {me && <FinanceTab headers={{}} readOnly={!me.canEditFinance} />}
      </div>
    </div>
  );
}

function PartnerLogin({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Sign-in failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <p className="text-sm font-medium text-white">Partner sign-in</p>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] text-mist">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="input w-full"
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] text-mist">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="input w-full"
        />
      </label>
      {err && (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {err}
        </p>
      )}
      <button
        disabled={busy || !username || !password}
        className="btn-primary mt-4 w-full py-2 text-sm disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-3 text-[11px] text-mist">
        Player or staff?{" "}
        <Link href="/account" className="underline">
          Sign in here
        </Link>
        .
      </p>
    </form>
  );
}
