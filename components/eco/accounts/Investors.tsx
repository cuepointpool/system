"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, ErrorNote, Label, Money, Toggle, useAccounts, useView, type Balances, type Investor } from "./ui";

const POSITIONS: [string, string][] = [
  ["director", "Director"],
  ["it_admin", "IT Admin"],
  ["secretary", "Secretary"],
  ["marketing", "Marketing"],
  ["treasurer", "Treasurer"],
];

type OverviewSlice = {
  balances: Balances;
  capitalByPartner: Record<string, number>;
  drawingsByPartner: Record<string, number>;
};

export function Investors() {
  const { meta } = useAccounts();
  const { data } = useView<OverviewSlice>({ view: "overview", today: meta.today });
  const isAdmin = meta.access.isAdmin;
  const list = meta.partners.filter((p) => isAdmin || p.active);
  const shareTotal = list.filter((p) => p.active).reduce((s, p) => s + p.sharePct, 0);
  const funds = data ? data.balances.cash + data.balances.bank : 0;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4",
          shareTotal === 100 ? "border-teal/25 bg-teal/[0.06]" : "border-amber-300/30 bg-amber-400/10",
        )}
      >
        <div>
          <p className="text-sm font-medium text-white">Ownership adds up to {shareTotal}%</p>
          <p className="text-[11px] text-mist">
            {shareTotal === 100
              ? "Shares are whole percentages. Profit, loss and equity on the reports are split by these."
              : "Shares should add up to exactly 100% — adjust them below."}
          </p>
        </div>
        <div className="flex h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/10 sm:w-64">
          {list
            .filter((p) => p.active)
            .map((p, i) => (
              <div
                key={p.id}
                title={`${p.name} ${p.sharePct}%`}
                style={{ width: `${p.sharePct}%`, opacity: 1 - i * 0.18 }}
                className="h-full bg-teal first:rounded-l-full last:rounded-r-full"
              />
            ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((p) => (
          <InvestorCard
            key={p.id}
            p={p}
            isAdmin={isAdmin}
            capital={data?.capitalByPartner[p.id] ?? 0}
            drawings={data?.drawingsByPartner[p.id] ?? 0}
            fundsShare={Math.round((funds * p.sharePct) / 100)}
          />
        ))}
      </div>
      {!isAdmin && (
        <p className="text-[11px] text-mist">Only the admin can change shares, logins and who may edit the accounts.</p>
      )}
    </div>
  );
}

function InvestorCard({
  p,
  isAdmin,
  capital,
  drawings,
  fundsShare,
}: {
  p: Investor;
  isAdmin: boolean;
  capital: number;
  drawings: number;
  fundsShare: number;
}) {
  const { headers, reloadMeta } = useAccounts();
  const [name, setName] = useState(p.name);
  const [share, setShare] = useState(String(p.sharePct));
  const [username, setUsername] = useState(p.username ?? "");
  const [password, setPassword] = useState("");
  const [positions, setPositions] = useState<string[]>(p.positions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, ...patch }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setPassword("");
      setSaved(true);
      reloadMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    name.trim() !== p.name ||
    Number(share) !== p.sharePct ||
    username !== (p.username ?? "") ||
    password.length > 0 ||
    [...positions].sort().join() !== [...p.positions].sort().join();

  return (
    <Card className={cn(!p.active && "opacity-60")}>
      <div className="flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#00c2a8 ${p.sharePct * 3.6}deg, rgba(255,255,255,0.08) 0)` }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-navy-900 font-display text-sm font-bold text-white">
            {p.sharePct}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-white">{p.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                p.canEditAccounts ? "bg-teal/15 text-teal" : "bg-white/10 text-mist",
              )}
            >
              {p.canEditAccounts ? "Can edit accounts" : "View only"}
            </span>
            {isAdmin && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px]", p.hasLogin ? "bg-white/10 text-white/80" : "bg-amber-400/15 text-amber-200")}>
                {p.hasLogin ? `login: ${p.username}` : "no login yet"}
              </span>
            )}
            {p.positions.map((pos) => (
              <span key={pos} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-mist">
                {POSITIONS.find(([v]) => v === pos)?.[1] ?? pos}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat k="Share of funds" v={fundsShare} />
        <Stat k="Capital in" v={capital} />
        <Stat k="Withdrawn" v={drawings} />
      </div>

      {isAdmin && (
        <div className="mt-5 space-y-4 border-t border-white/[0.07] pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3.5 py-3">
            <div>
              <p className="text-xs font-medium text-white">Allow editing the accounts</p>
              <p className="text-[10px] text-mist">Off = can only view entries and reports.</p>
            </div>
            <Toggle
              on={p.canEditAccounts}
              disabled={busy}
              onChange={(v) => save({ canEditAccounts: v })}
            />
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <label className="block">
              <Label>Name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input h-9 text-sm" />
            </label>
            <label className="block">
              <Label>Share %</Label>
              <input
                inputMode="numeric"
                value={share}
                onChange={(e) => setShare(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                className="input h-9 text-center text-sm tabular-nums"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <Label>Username</Label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="input h-9 text-xs" />
            </label>
            <label className="block">
              <Label>{p.hasLogin ? "New password" : "Password"}</Label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 8 characters"
                autoComplete="off"
                className="input h-9 text-xs"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPositions((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px]",
                  positions.includes(v) ? "border-teal/40 bg-teal/10 text-teal" : "border-white/10 text-mist",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <ErrorNote text={err} />
          <div className="flex items-center gap-3">
            <button
              disabled={busy || !dirty}
              onClick={() =>
                save({
                  name: name.trim(),
                  sharePct: Number(share) || 0,
                  username,
                  positions,
                  ...(password ? { password } : {}),
                })
              }
              className="btn-primary px-5 py-2 text-xs disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            {saved && !dirty && <span className="text-[11px] text-teal">✓ Saved</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-2 py-2.5">
      <Money v={v} tag={false} className="block font-display text-base font-bold text-white" />
      <p className="mt-0.5 text-[10px] text-mist">{k}</p>
    </div>
  );
}
