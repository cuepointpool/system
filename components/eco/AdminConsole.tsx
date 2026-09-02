"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tabs } from "./Primitives";
import { cn, formatDateShort, formatLKR, label12h, timeAgo } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  OTHER_CATEGORY,
} from "@/lib/expense-categories";
import {
  DURATION_OPTIONS,
  billableHours,
  priceFor,
  slotStartsForDate,
  type Booking,
} from "@/lib/booking";
import type {
  AuditEntry,
  MatchType,
  MatchView,
  MembershipPlan,
  Promotion,
  SkillLevel,
  Tournament,
  UserRole,
} from "@/lib/ecosystem/types";

const TABLES = ["Table 1", "Table 2", "Table 3", "VIP Booth"];
const SKILLS: SkillLevel[] = [
  "Rookie",
  "Amateur",
  "Intermediate",
  "Advanced",
  "Pro",
];
const TIERS = ["basic", "pro", "elite"] as const;

type Tab =
  | "matches"
  | "players"
  | "tournaments"
  | "promotions"
  | "membership"
  | "tables"
  | "bookings"
  | "finance"
  | "audit";

type VenueTable = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  sortOrder: number;
  active: boolean;
};

type StaffPlayer = {
  id: string;
  slug: string;
  nickname: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  skillLevel: SkillLevel;
  membershipTier: string;
  rank: number;
  matchesPlayed: number;
  rankingPoints: number;
};

export function AdminConsole() {
  const [key, setKey] = useState("");
  const [tab, setTab] = useState<Tab>("matches");
  const [me, setMe] = useState<{ role: UserRole } | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(localStorage.getItem("cp_admin_key") ?? "");
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.viewer ? { role: d.viewer.role } : null))
      .catch(() => setMe(null));
  }, []);

  const headers = useMemo(
    () =>
      (key
        ? { "x-admin-key": key, "x-staff-key": key }
        : {}) as Record<string, string>,
    [key],
  );

  const isStaff = me?.role === "staff" || me?.role === "admin";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-teal">
            Cue Point · staff
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Operations console
          </h1>
          <p className="mt-1.5 text-sm text-mist">
            Create players, run tournaments, record official results, manage
            offers &amp; memberships. Every action is validated server-side and
            written to the audit log.
          </p>
        </div>
        {!isStaff && (
          <label className="block">
            <span className="mb-1.5 block text-[11px] text-mist">
              Staff key{" "}
              <span className="text-mist/50">
                (or sign in with a staff account)
              </span>
            </span>
            <div className="flex gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="STAFF_KEY"
                className="input w-44"
              />
              <button
                onClick={() => localStorage.setItem("cp_admin_key", key)}
                className="btn-ghost px-4 py-2 text-xs"
              >
                Save
              </button>
            </div>
          </label>
        )}
      </div>

      {me === null && !key && (
        <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          You&apos;re not signed in as staff. Actions will fail unless you add a
          valid staff key or{" "}
          <Link href="/account" className="underline">
            sign in
          </Link>
          .
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <Tabs
          tabs={[
            { value: "matches", label: "Record result" },
            { value: "players", label: "Players" },
            { value: "tournaments", label: "Tournaments" },
            { value: "promotions", label: "Offers" },
            { value: "membership", label: "Membership" },
            { value: "tables", label: "Tables" },
            { value: "bookings", label: "Bookings" },
            ...(me?.role === "admin"
              ? [{ value: "finance", label: "Finance" }]
              : []),
            { value: "audit", label: "Audit" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      <div className="mt-8">
        {tab === "matches" && <MatchTab headers={headers} />}
        {tab === "players" && <PlayersTab headers={headers} />}
        {tab === "tournaments" && <TournamentsTab headers={headers} />}
        {tab === "promotions" && <PromotionsTab headers={headers} />}
        {tab === "membership" && <MembershipTab headers={headers} />}
        {tab === "tables" && <TablesTab headers={headers} />}
        {tab === "bookings" && <BookingsTab headers={headers} />}
        {tab === "finance" &&
          (me?.role === "admin" ? (
            <FinanceTab headers={headers} />
          ) : (
            <p className="text-sm text-mist">Finance is admin-only.</p>
          ))}
        {tab === "audit" && <AuditTab headers={headers} />}
      </div>
    </div>
  );
}

/* ================= shared helpers ================= */

function jpost(url: string, headers: Record<string, string>, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function jpatch(url: string, headers: Record<string, string>, body: unknown) {
  return fetch(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-mist">{label}</span>
      {children}
    </label>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        msg.ok
          ? "border-teal/30 bg-teal/10 text-teal"
          : "border-rose-400/30 bg-rose-400/10 text-rose-200",
      )}
    >
      {msg.text}
    </p>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.24em] text-teal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function useStaffData<T>(
  url: string,
  headers: Record<string, string>,
  pick: (d: Record<string, unknown>) => T,
) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const headerKey = JSON.stringify(headers);
  const load = useCallback(() => {
    fetch(url, { headers: JSON.parse(headerKey), cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setData(pick(d)) : setErr(d.error)))
      .catch(() => setErr("Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, headerKey]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, err, reload: load };
}

/* ================= Record result ================= */

function MatchTab({ headers }: { headers: Record<string, string> }) {
  const { data: players } = useStaffData(
    "/api/staff/players",
    headers,
    (d) => d.players as StaffPlayer[],
  );
  const { data: tournaments } = useStaffData(
    "/api/tournaments",
    headers,
    (d) => d.tournaments as (Tournament & { registeredCount: number })[],
  );
  const { data: bundle, reload } = useStaffData(
    "/api/staff/matches",
    headers,
    (d) => d as { matches: MatchView[]; audit: AuditEntry[] },
  );
  const recent = bundle?.matches ?? [];

  const [form, setForm] = useState({
    type: "ranked" as MatchType,
    playerAId: "",
    playerBId: "",
    tableName: TABLES[0],
    tournamentId: "",
    scoreA: 0,
    scoreB: 0,
  });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = players ?? [];
  const a = list.find((p) => p.id === form.playerAId);
  const b = list.find((p) => p.id === form.playerBId);
  const winnerId =
    form.scoreA === form.scoreB
      ? ""
      : form.scoreA > form.scoreB
        ? form.playerAId
        : form.playerBId;
  const ready =
    form.playerAId &&
    form.playerBId &&
    form.playerAId !== form.playerBId &&
    winnerId &&
    (form.type !== "tournament" || form.tournamentId);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await jpost("/api/staff/matches", headers, {
        type: form.type,
        playerAId: form.playerAId,
        playerBId: form.playerBId,
        tableName: form.tableName,
        tournamentId: form.type === "tournament" ? form.tournamentId : null,
        scoreA: form.scoreA,
        scoreB: form.scoreB,
        winnerId,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg({
        ok: true,
        text: `Recorded ${d.match.playerA.nickname} ${d.match.scoreA}-${d.match.scoreB} ${d.match.playerB.nickname}. Rankings updated.`,
      });
      setForm((f) => ({ ...f, playerAId: "", playerBId: "", scoreA: 0, scoreB: 0 }));
      setConfirming(false);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Panel title="New official result">
        {list.length < 2 ? (
          <p className="text-[13px] text-mist">
            You need at least two players. Add them in the{" "}
            <strong>Players</strong> tab first.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Match type">
              <div className="flex gap-2">
                {(["ranked", "casual", "tournament"] as MatchType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm capitalize transition-colors",
                      form.type === t
                        ? "border-teal bg-teal/12 text-white"
                        : "border-white/12 text-mist hover:border-white/30",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            {form.type === "tournament" && (
              <Field label="Tournament">
                <select
                  value={form.tournamentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tournamentId: e.target.value }))
                  }
                  className="input"
                >
                  <option value="">Select…</option>
                  {(tournaments ?? [])
                    .filter((t) => t.status !== "completed")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Player 1">
                <PlayerSelect
                  players={list}
                  value={form.playerAId}
                  exclude={form.playerBId}
                  onChange={(v) => setForm((f) => ({ ...f, playerAId: v }))}
                />
              </Field>
              <Field label="Player 2">
                <PlayerSelect
                  players={list}
                  value={form.playerBId}
                  exclude={form.playerAId}
                  onChange={(v) => setForm((f) => ({ ...f, playerBId: v }))}
                />
              </Field>
            </div>

            <Field label="Score">
              <div className="flex items-center gap-3">
                <ScoreStepper
                  value={form.scoreA}
                  onChange={(v) => setForm((f) => ({ ...f, scoreA: v }))}
                />
                <span className="text-mist">–</span>
                <ScoreStepper
                  value={form.scoreB}
                  onChange={(v) => setForm((f) => ({ ...f, scoreB: v }))}
                />
              </div>
            </Field>

            <Field label="Table">
              <select
                value={form.tableName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tableName: e.target.value }))
                }
                className="input"
              >
                {TABLES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm">
              <span className="text-mist">Winner: </span>
              <span className="font-semibold text-white">
                {winnerId
                  ? winnerId === form.playerAId
                    ? a?.nickname
                    : b?.nickname
                  : "—"}
              </span>
            </div>

            <Msg msg={msg} />

            {!confirming ? (
              <button
                disabled={!ready}
                onClick={() => setConfirming(true)}
                className="btn-primary w-full py-3 text-sm disabled:opacity-40"
              >
                Review result
              </button>
            ) : (
              <div className="rounded-xl border border-teal/30 bg-teal/[0.06] p-4">
                <p className="text-sm text-white">
                  Confirm: <strong>{a?.nickname}</strong> {form.scoreA}–
                  {form.scoreB} <strong>{b?.nickname}</strong>{" "}
                  ({form.type})
                </p>
                <p className="mt-1 text-[11px] text-mist">
                  Updates matches, W/L, win %, ranking points &amp; positions,
                  recent form, and any linked tournament bracket. Audited.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="btn-ghost flex-1 py-2.5 text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Confirm & save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-[0.24em] text-teal">
          Recently recorded
        </h2>
        <div className="space-y-2">
          {recent.slice(0, 12).map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
            >
              <span className="block truncate text-white">
                {m.playerA.nickname}{" "}
                <span className="text-mist">
                  {m.scoreA}-{m.scoreB}
                </span>{" "}
                {m.playerB.nickname}
              </span>
              <span className="text-[11px] text-mist/60">
                {m.type}
                {m.tournamentName ? ` · ${m.tournamentName}` : ""} ·{" "}
                {timeAgo(m.playedAt)} · {m.recordedBy}
              </span>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-mist">
              No matches recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerSelect({
  players,
  value,
  exclude,
  onChange,
}: {
  players: StaffPlayer[];
  value: string;
  exclude: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      <option value="">Select…</option>
      {players
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}
            {p.rank ? ` (#${p.rank})` : ""}
          </option>
        ))}
    </select>
  );
}

function ScoreStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-9 w-9 rounded-lg border border-white/12 text-white hover:border-teal/50"
      >
        –
      </button>
      <span className="w-8 text-center font-display text-xl text-white">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(15, value + 1))}
        className="h-9 w-9 rounded-lg border border-white/12 text-white hover:border-teal/50"
      >
        +
      </button>
    </div>
  );
}

/* ================= Players ================= */

function PlayersTab({ headers }: { headers: Record<string, string> }) {
  const { data: players, reload } = useStaffData(
    "/api/staff/players",
    headers,
    (d) => d.players as StaffPlayer[],
  );
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    nickname: "",
    email: "",
    skillLevel: "Rookie" as SkillLevel,
    membershipTier: "basic",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await jpost("/api/staff/players", headers, form);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg({ ok: true, text: `Added ${d.player.nickname}` });
      setForm((f) => ({ ...f, fullName: "", nickname: "", email: "" }));
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await jpatch("/api/staff/players", headers, { id, ...body });
    reload();
  }

  const rows = (players ?? []).filter(
    (p) =>
      !q ||
      p.nickname.toLowerCase().includes(q.toLowerCase()) ||
      p.fullName.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <Panel title="Add a player">
        <p className="mb-4 text-[12px] text-mist">
          For walk-in players who don&apos;t register themselves. They get a
          public profile immediately; they can claim the account later by
          registering with a matching email.
        </p>
        <div className="space-y-3">
          <Field label="Full name">
            <input
              className="input"
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
              placeholder="Ishara Perera"
            />
          </Field>
          <Field label="Player name">
            <input
              className="input"
              value={form.nickname}
              onChange={(e) =>
                setForm((f) => ({ ...f, nickname: e.target.value }))
              }
              placeholder="CueBallIsh"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              className="input"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="you@email.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Skill level">
              <select
                className="input"
                value={form.skillLevel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    skillLevel: e.target.value as SkillLevel,
                  }))
                }
              >
                {SKILLS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Membership">
              <select
                className="input"
                value={form.membershipTier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, membershipTier: e.target.value }))
                }
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Msg msg={msg} />
          <button
            onClick={create}
            disabled={busy || !form.fullName || !form.nickname}
            className="btn-primary w-full py-3 text-sm disabled:opacity-40"
          >
            {busy ? "…" : "Add player"}
          </button>
        </div>
      </Panel>

      <Panel
        title={`Players (${rows.length})`}
        action={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="input !w-40 !py-1.5 text-xs"
          />
        }
      >
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {rows.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/players/${p.slug}`}
                  className="text-sm font-semibold text-white hover:text-teal"
                >
                  {p.nickname}
                  <span className="ml-2 text-[11px] font-normal text-mist">
                    {p.fullName}
                  </span>
                </Link>
                <span className="text-[11px] text-mist">
                  {p.rank ? `#${p.rank}` : "unranked"} · {p.matchesPlayed} MP
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <select
                  value={p.skillLevel}
                  onChange={(e) => patch(p.id, { skillLevel: e.target.value })}
                  className="input !py-1.5 text-xs"
                >
                  {SKILLS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={p.membershipTier}
                  onChange={(e) =>
                    patch(p.id, { membershipTier: e.target.value })
                  }
                  className="input !py-1.5 text-xs"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={p.role}
                  onChange={(e) => patch(p.id, { role: e.target.value })}
                  className="input !py-1.5 text-xs"
                >
                  <option value="player">player</option>
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <LoyaltyAdjust playerId={p.id} headers={headers} />
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-mist">No players.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function LoyaltyAdjust({
  playerId,
  headers,
}: {
  playerId: string;
  headers: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<string | null>(null);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] font-medium text-teal"
      >
        Adjust loyalty →
      </button>
    );
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <input
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        placeholder="± pts"
        className="input !w-20 !py-1.5 text-xs"
        inputMode="numeric"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="input !w-40 !py-1.5 text-xs"
      />
      <button
        onClick={async () => {
          const res = await jpost("/api/staff/loyalty", headers, {
            playerId,
            points: Number(points),
            reason,
          });
          setState(res.ok ? "✓" : "✗");
          if (res.ok) {
            setPoints("");
            setReason("");
          }
        }}
        className="btn-primary !px-3 !py-1.5 text-xs"
      >
        Apply {state}
      </button>
    </div>
  );
}

/* ================= Tournaments ================= */

function TournamentsTab({ headers }: { headers: Record<string, string> }) {
  const { data: list, reload } = useStaffData(
    "/api/tournaments",
    headers,
    (d) =>
      d.tournaments as (Tournament & {
        registeredCount: number;
        spotsLeft: number;
      })[],
  );
  const [form, setForm] = useState({
    name: "",
    summary: "",
    startAt: "",
    registrationDeadline: "",
    entryFee: "1000",
    prizePool: "50000",
    maxPlayers: "8",
    format: "single_elim",
    rules: "8-ball, World Rules. Race to 7 (final race to 9).\nWinner breaks. Standard 3-foul rule.\nReport 15 minutes before your match.",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await jpost("/api/staff/tournaments", headers, {
        ...form,
        entryFee: Number(form.entryFee),
        prizePool: Number(form.prizePool),
        maxPlayers: Number(form.maxPlayers),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg({ ok: true, text: `Created ${d.tournament.name}` });
      setForm((f) => ({ ...f, name: "", summary: "" }));
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function act(slug: string, body: Record<string, unknown>) {
    const res = await jpatch("/api/staff/tournaments", headers, { slug, ...body });
    const d = await res.json();
    if (!res.ok) setMsg({ ok: false, text: d.error });
    reload();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel title="Create a tournament">
        <div className="space-y-3">
          <Field label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Pitipana Masters"
            />
          </Field>
          <Field label="Summary">
            <input
              className="input"
              value={form.summary}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
              placeholder="One line about the event"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                type="datetime-local"
                className="input"
                value={form.startAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startAt: e.target.value }))
                }
              />
            </Field>
            <Field label="Registration deadline">
              <input
                type="datetime-local"
                className="input"
                value={form.registrationDeadline}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    registrationDeadline: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Entry fee">
              <input
                className="input"
                value={form.entryFee}
                onChange={(e) =>
                  setForm((f) => ({ ...f, entryFee: e.target.value }))
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Prize pool">
              <input
                className="input"
                value={form.prizePool}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prizePool: e.target.value }))
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Max players">
              <select
                className="input"
                value={form.maxPlayers}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxPlayers: e.target.value }))
                }
              >
                {["4", "8", "16"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Rules (one per line)">
            <textarea
              className="input resize-none"
              rows={3}
              value={form.rules}
              onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            />
          </Field>
          <Msg msg={msg} />
          <button
            onClick={create}
            disabled={
              busy ||
              !form.name ||
              !form.startAt ||
              !form.registrationDeadline
            }
            className="btn-primary w-full py-3 text-sm disabled:opacity-40"
          >
            {busy ? "…" : "Create tournament"}
          </button>
        </div>
      </Panel>

      <Panel title={`Tournaments (${list?.length ?? 0})`}>
        <div className="space-y-3">
          {(list ?? []).map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/tournaments/${t.slug}`}
                  className="font-semibold text-white hover:text-teal"
                >
                  {t.name}
                </Link>
                <span className="text-[11px] uppercase tracking-wide text-mist">
                  {t.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-mist">
                {t.registeredCount}/{t.maxPlayers} players ·{" "}
                {t.bracket.length ? "bracket generated" : "no bracket"} ·{" "}
                {formatDateShort(t.startAt)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status === "registration_open" && (
                  <button
                    onClick={() =>
                      act(t.slug, {
                        action: "set-status",
                        status: "registration_closed",
                      })
                    }
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                  >
                    Close registration
                  </button>
                )}
                {!t.bracket.length && t.registeredCount >= 4 && (
                  <button
                    onClick={() => act(t.slug, { action: "generate-bracket" })}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                  >
                    Generate bracket
                  </button>
                )}
                {t.status !== "completed" && t.status !== "cancelled" && (
                  <button
                    onClick={() =>
                      act(t.slug, {
                        action: "set-status",
                        status: "cancelled",
                      })
                    }
                    className="btn-ghost !px-3 !py-1.5 text-xs text-rose-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
          {list && list.length === 0 && (
            <p className="text-xs text-mist">No tournaments yet.</p>
          )}
        </div>
        <p className="mt-4 text-[11px] text-mist/70">
          Record bracket results in the <strong>Record result</strong> tab
          (type: tournament) — winners advance automatically, and the champion is
          set when the final is entered.
        </p>
      </Panel>
    </div>
  );
}

/* ================= Offers ================= */

function PromotionsTab({ headers }: { headers: Record<string, string> }) {
  const { data: list, reload } = useStaffData(
    "/api/staff/promotions",
    headers,
    (d) => d.promotions as (Promotion & { state: string })[],
  );
  const [form, setForm] = useState({
    title: "",
    description: "",
    discount: "",
    type: "limited",
    startAt: "",
    endAt: "",
    eligibility: "Everyone",
    promoCode: "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create() {
    setMsg(null);
    const res = await jpost("/api/staff/promotions", headers, form);
    const d = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: d.error });
    setMsg({ ok: true, text: `Created “${d.promotion.title}”` });
    setForm((f) => ({ ...f, title: "", description: "", discount: "", promoCode: "" }));
    reload();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <Panel title="New offer">
        <div className="space-y-3">
          <Field label="Title">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Weekday Happy Hour"
            />
          </Field>
          <Field label="Description">
            <input
              className="input"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (text)">
              <input
                className="input"
                value={form.discount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discount: e.target.value }))
                }
                placeholder="40% off table time"
              />
            </Field>
            <Field label="Type">
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                {[
                  "happy_hour",
                  "student",
                  "group",
                  "weekend",
                  "tournament",
                  "membership",
                  "loyalty",
                  "limited",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                type="datetime-local"
                className="input"
                value={form.startAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startAt: e.target.value }))
                }
              />
            </Field>
            <Field label="Ends">
              <input
                type="datetime-local"
                className="input"
                value={form.endAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endAt: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eligibility">
              <input
                className="input"
                value={form.eligibility}
                onChange={(e) =>
                  setForm((f) => ({ ...f, eligibility: e.target.value }))
                }
              />
            </Field>
            <Field label="Promo code (optional)">
              <input
                className="input"
                value={form.promoCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, promoCode: e.target.value }))
                }
              />
            </Field>
          </div>
          <Msg msg={msg} />
          <button
            onClick={create}
            disabled={
              !form.title || !form.discount || !form.startAt || !form.endAt
            }
            className="btn-primary w-full py-3 text-sm disabled:opacity-40"
          >
            Create offer
          </button>
        </div>
      </Panel>

      <Panel title={`Offers (${list?.length ?? 0})`}>
        <div className="space-y-2">
          {(list ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">
                  {p.title}
                </span>
                <span className="text-[11px] text-mist">
                  {p.discount} · {formatDateShort(p.startAt)}–
                  {formatDateShort(p.endAt)} ·{" "}
                  <span
                    className={cn(
                      p.state === "active" && "text-teal",
                      p.status === "hidden" && "text-mist/50",
                    )}
                  >
                    {p.status === "hidden" ? "hidden" : p.state}
                  </span>
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={async () => {
                    await jpatch("/api/staff/promotions", headers, {
                      id: p.id,
                      status: p.status === "hidden" ? "active" : "hidden",
                    });
                    reload();
                  }}
                  className="btn-ghost !px-2.5 !py-1 text-[11px]"
                >
                  {p.status === "hidden" ? "Show" : "Hide"}
                </button>
                <button
                  onClick={async () => {
                    await fetch(`/api/staff/promotions?id=${p.id}`, {
                      method: "DELETE",
                      headers,
                    });
                    reload();
                  }}
                  className="btn-ghost !px-2.5 !py-1 text-[11px] text-rose-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {list && list.length === 0 && (
            <p className="text-xs text-mist">No offers yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ================= Membership plans ================= */

function MembershipTab({ headers }: { headers: Record<string, string> }) {
  const { data, reload } = useStaffData(
    "/api/staff/memberships",
    headers,
    (d) => d.plans as MembershipPlan[],
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <Panel title="Membership plans">
      <p className="mb-4 text-[12px] text-mist">
        Pricing and headline perks. Benefit bullet lists are edited in
        <code className="mx-1 text-teal">scripts/setup.ts</code>.
      </p>
      <Msg msg={msg} />
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {(data ?? []).map((plan) => (
          <PlanEditor
            key={plan.id}
            plan={plan}
            onSave={async (patch) => {
              const res = await jpatch("/api/staff/memberships", headers, {
                id: plan.id,
                ...patch,
              });
              setMsg(
                res.ok
                  ? { ok: true, text: `${plan.name} updated` }
                  : { ok: false, text: "Update failed" },
              );
              reload();
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: MembershipPlan;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [price, setPrice] = useState(String(plan.price));
  const [disc, setDisc] = useState(String(plan.discountPct));
  const [mult, setMult] = useState(String(plan.loyaltyMultiplier));
  const [tagline, setTagline] = useState(plan.tagline);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="font-display text-lg font-bold text-white">{plan.name}</div>
      <div className="mt-3 space-y-2">
        <Field label="Price (LKR / month)">
          <input
            className="input !py-1.5 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <Field label="Tagline">
          <input
            className="input !py-1.5 text-sm"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Discount %">
            <input
              className="input !py-1.5 text-sm"
              value={disc}
              onChange={(e) => setDisc(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Loyalty ×">
            <input
              className="input !py-1.5 text-sm"
              value={mult}
              onChange={(e) => setMult(e.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>
      </div>
      <button
        onClick={() =>
          onSave({
            price: Number(price),
            discountPct: Number(disc),
            loyaltyMultiplier: Number(mult),
            tagline,
          })
        }
        className="btn-primary mt-3 w-full py-2 text-xs"
      >
        Save
      </button>
    </div>
  );
}

/* ================= Audit ================= */

function AuditTab({ headers }: { headers: Record<string, string> }) {
  const { data, err } = useStaffData(
    "/api/staff/matches",
    headers,
    (d) => d.audit as AuditEntry[],
  );
  if (err)
    return (
      <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
        {err} — sign in as staff or add a staff key.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
          <tr>
            {["When", "Actor", "Action", "Entity", "Detail"].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {(data ?? []).map((a) => (
            <tr key={a.id} className="text-white/90">
              <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-mist">
                {timeAgo(a.at)}
              </td>
              <td className="px-4 py-2.5 text-[12px]">{a.actor}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-teal">
                {a.action}
              </td>
              <td className="px-4 py-2.5 text-[12px] text-mist">{a.entity}</td>
              <td className="px-4 py-2.5 text-[12px]">{a.detail}</td>
            </tr>
          ))}
          {data && data.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-mist">
                No audit entries.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ================= Tables ================= */

function TablesTab({ headers }: { headers: Record<string, string> }) {
  const { data, reload } = useStaffData(
    "/api/staff/tables",
    headers,
    (d) => d.tables as VenueTable[],
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [label, setLabel] = useState("");
  const [area, setArea] = useState("Main floor");
  const [note, setNote] = useState("");
  const [seats, setSeats] = useState("4");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    const res = await jpost("/api/staff/tables", headers, {
      label,
      area,
      note,
      seats: Number(seats) || 4,
    });
    setBusy(false);
    if (res.ok) {
      setLabel("");
      setNote("");
      setMsg({ ok: true, text: `Added ${label}` });
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: d.error || "Could not add table" });
    }
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    const res = await jpatch("/api/staff/tables", headers, { id, ...body });
    setMsg(
      res.ok ? { ok: true, text: ok } : { ok: false, text: "Update failed" },
    );
    reload();
  }

  async function remove(t: VenueTable) {
    if (!confirm(`Remove "${t.label}"? Past bookings keep it in the record.`))
      return;
    const res = await fetch(`/api/staff/tables?id=${encodeURIComponent(t.id)}`, {
      method: "DELETE",
      headers,
    });
    setMsg(
      res.ok
        ? { ok: true, text: `Removed ${t.label}` }
        : { ok: false, text: "Delete failed" },
    );
    reload();
  }

  const rows = data ?? [];

  return (
    <Panel title="Floor tables">
      <p className="mb-4 text-[12px] text-mist">
        Tables here are what players pick when booking. Add, rename or retire
        them — the booking flow updates live.
      </p>
      <Msg msg={msg} />

      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1.4fr_1fr_0.6fr_auto] sm:items-end">
        <Field label="Table name">
          <input
            className="input !py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Table 4 — The Corner"
          />
        </Field>
        <Field label="Area">
          <input
            className="input !py-1.5 text-sm"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Main floor"
          />
        </Field>
        <Field label="Seats">
          <input
            className="input !py-1.5 text-sm"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <button
          onClick={add}
          disabled={busy || !label.trim()}
          className="btn-primary h-9 px-4 text-sm disabled:opacity-40"
        >
          Add table
        </button>
        <div className="sm:col-span-4">
          <Field label="Note (optional)">
            <input
              className="input !py-1.5 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="9ft King Model · tournament cloth"
            />
          </Field>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((t) => (
          <TableRowEditor
            key={t.id}
            table={t}
            onSave={(patchBody) => patch(t.id, patchBody, `${t.label} updated`)}
            onToggle={() =>
              patch(
                t.id,
                { active: !t.active },
                t.active ? `${t.label} hidden` : `${t.label} live`,
              )
            }
            onRemove={() => remove(t)}
          />
        ))}
        {rows.length === 0 && (
          <li className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-mist">
            No tables yet — add the first one above.
          </li>
        )}
      </ul>
    </Panel>
  );
}

function TableRowEditor({
  table,
  onSave,
  onToggle,
  onRemove,
}: {
  table: VenueTable;
  onSave: (patch: Record<string, unknown>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(table.label);
  const [area, setArea] = useState(table.area);
  const [note, setNote] = useState(table.note);
  const [seats, setSeats] = useState(String(table.seats));
  const dirty =
    label !== table.label ||
    area !== table.area ||
    note !== table.note ||
    Number(seats) !== table.seats;

  return (
    <li
      className={cn(
        "rounded-xl border p-3 sm:p-4",
        table.active
          ? "border-white/10 bg-white/[0.02]"
          : "border-white/8 bg-white/[0.01] opacity-70",
      )}
    >
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.5fr] sm:items-center">
        <input
          className="input !py-1.5 text-sm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="input !py-1.5 text-sm"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <input
          className="input !py-1.5 text-sm"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          inputMode="numeric"
        />
      </div>
      <input
        className="input mt-2 !py-1.5 text-sm"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="mr-auto font-mono text-[10px] text-mist/60">
          {table.id}
        </span>
        <button
          onClick={() =>
            onSave({
              label,
              area,
              note,
              seats: Number(seats) || table.seats,
            })
          }
          disabled={!dirty}
          className="btn-primary h-8 px-3 text-xs disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={onToggle}
          className="h-8 rounded-lg border border-white/12 px-3 text-xs text-white hover:border-teal/50"
        >
          {table.active ? "Hide" : "Show"}
        </button>
        <button
          onClick={onRemove}
          className="h-8 rounded-lg border border-rose-400/30 px-3 text-xs text-rose-200 hover:bg-rose-400/10"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/* ================= Bookings ================= */

type TableLite = { id: string; label: string; area: string; seats: number };
type PlayerLite = { id: string; fullName: string; nickname: string };

function durLabel(h: number) {
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  if (whole === 0) return "30 min";
  return half ? `${whole}h 30m` : `${whole}h`;
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function localDT(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function hourAgoDT() {
  const d = new Date();
  d.setHours(d.getHours() - 1);
  return localDT(d);
}

function BookingsTab({ headers }: { headers: Record<string, string> }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tables, setTables] = useState<TableLite[]>([]);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [fDate, setFDate] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extendId, setExtendId] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (fDate) qs.set("date", fDate);
    if (fStatus) qs.set("status", fStatus);
    fetch(`/api/staff/bookings?${qs.toString()}`, { headers, cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setBookings(d.bookings);
          setError(null);
        } else setError(d.error || "Failed to load");
      })
      .catch(() => setError("Failed to load"));
  }, [headers, fDate, fStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tables) && setTables(d.tables))
      .catch(() => {});
    fetch("/api/staff/players", { headers })
      .then((r) => r.json())
      .then(
        (d) =>
          Array.isArray(d.players) &&
          setPlayers(
            d.players.map((p: PlayerLite) => ({
              id: p.id,
              fullName: p.fullName,
              nickname: p.nickname,
            })),
          ),
      )
      .catch(() => {});
  }, [headers]);

  const act = useCallback(
    async (
      body: Record<string, unknown>,
      method: "POST" | "PATCH" | "DELETE" = "PATCH",
    ) => {
      setBusy(true);
      setError(null);
      try {
        const res =
          method === "DELETE"
            ? await fetch(`/api/staff/bookings?id=${body.id}`, {
                method,
                headers,
              })
            : await fetch(`/api/staff/bookings`, {
                method,
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Action failed");
        load();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [headers, load],
  );

  const list = bookings ?? [];
  const openSessions = list.filter((b) => b.checkedInAt && !b.checkedOutAt);
  const revenue = list
    .filter((b) => b.status !== "CANCELLED")
    .reduce((s, b) => s + b.totalAmount, 0);
  const unpaid = list.filter(
    (b) => b.status !== "CANCELLED" && b.paymentStatus === "unpaid",
  ).length;

  return (
    <div className="space-y-9">
      {error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {/* ---- live sessions ---- */}
      <section>
        <SectionHead
          title="On the floor now"
          sub="Walk-in sessions that are still running. End one to bill the played time."
        />
        {openSessions.length === 0 ? (
          <p className="text-sm text-mist">No open sessions right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {openSessions.map((b) => (
              <OpenSessionCard
                key={b.id}
                b={b}
                busy={busy}
                onEnd={(payload) =>
                  act({ id: b.id, action: "checkout", ...payload })
                }
                onCancel={() => act({ id: b.id, action: "cancel" })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- assign a table ---- */}
      <section>
        <SectionHead
          title="Assign a table"
          sub="Seat a walk-in now, log a visit that already finished, or reserve a slot for someone who didn't book online. Link a registered player if they have an account."
        />
        <AssignForm
          tables={tables}
          players={players}
          busy={busy}
          onSubmit={(body) => act(body, "POST")}
        />
      </section>

      {/* ---- all bookings ---- */}
      <section>
        <SectionHead title="All bookings" sub="Every reservation, walk-in and staff booking." />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-mist">Date</span>
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-mist">Status</span>
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PENDING">Pending</option>
            </select>
          </label>
          {(fDate || fStatus) && (
            <button
              onClick={() => {
                setFDate("");
                setFStatus("");
              }}
              className="btn-ghost px-3 py-2 text-xs"
            >
              Clear
            </button>
          )}
          <button onClick={load} className="btn-ghost px-4 py-2 text-xs">
            Refresh
          </button>
        </div>

        {bookings && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat k="Shown" v={String(list.length)} />
              <MiniStat k="Open sessions" v={String(openSessions.length)} />
              <MiniStat k="Unpaid" v={String(unpaid)} />
              <MiniStat k="Revenue" v={formatLKR(revenue)} />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
                  <tr>
                    {[
                      "Ref",
                      "Table",
                      "When",
                      "Party",
                      "Name",
                      "Origin",
                      "Total",
                      "Paid",
                      "Status",
                      "",
                    ].map((h) => (
                      <th key={h} className="px-3 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {list.map((b) => {
                    const openNow = !!b.checkedInAt && !b.checkedOutAt;
                    return (
                      <Fragment key={b.id}>
                      <tr className="text-white/90">
                        <td className="px-3 py-2.5 font-mono text-[11px] text-teal">
                          {b.reference}
                        </td>
                        <td className="px-3 py-2.5">{b.tableName}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {b.date} · {label12h(b.startTime)}
                          {openNow ? (
                            <span className="text-teal"> · live</span>
                          ) : (
                            ` · ${durLabel(b.durationHrs)}`
                          )}
                        </td>
                        <td className="px-3 py-2.5">{b.partySize}</td>
                        <td className="px-3 py-2.5">{b.customerName}</td>
                        <td className="px-3 py-2.5">
                          <OriginBadge origin={b.origin} />
                        </td>
                        <td className="px-3 py-2.5">{formatLKR(b.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          <button
                            disabled={busy || b.status === "CANCELLED"}
                            onClick={() =>
                              act({
                                id: b.id,
                                action:
                                  b.paymentStatus === "paid" ? "unpay" : "pay",
                              })
                            }
                            className={cn(
                              "rounded-full px-2 py-1 text-[11px] transition-colors disabled:opacity-40",
                              b.paymentStatus === "paid"
                                ? "bg-teal/15 text-teal hover:bg-teal/25"
                                : "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25",
                            )}
                          >
                            {b.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[11px]",
                              b.status === "CONFIRMED"
                                ? "bg-teal/15 text-teal"
                                : "bg-white/10 text-mist",
                            )}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2">
                            {b.status !== "CANCELLED" && !openNow && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setExtendId(extendId === b.id ? null : b.id)
                                }
                                className="text-[11px] text-teal hover:text-teal-bright"
                              >
                                + time
                              </button>
                            )}
                            {b.status !== "CANCELLED" && !openNow && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  act({ id: b.id, action: "cancel" })
                                }
                                className="text-[11px] text-mist hover:text-white"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (confirm(`Delete booking ${b.reference}?`))
                                  act({ id: b.id }, "DELETE");
                              }}
                              className="text-[11px] text-rose-300/80 hover:text-rose-200"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {extendId === b.id && (
                        <tr className="bg-teal/[0.04]">
                          <td colSpan={10} className="px-3 py-3">
                            <ExtendRow
                              b={b}
                              busy={busy}
                              onConfirm={async (addHours, paid) => {
                                const done = await act({
                                  id: b.id,
                                  action: "extend",
                                  addHours,
                                  paymentStatus: paid ? "paid" : undefined,
                                });
                                if (done) setExtendId(null);
                              }}
                              onClose={() => setExtendId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-3 py-6 text-center text-sm text-mist"
                      >
                        No bookings match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-mist">{sub}</p>
    </div>
  );
}

function OriginBadge({ origin }: { origin: Booking["origin"] }) {
  const map: Record<Booking["origin"], string> = {
    online: "bg-white/10 text-mist",
    walk_in: "bg-teal/15 text-teal",
    staff: "bg-indigo-400/15 text-indigo-200",
  };
  const label = origin === "walk_in" ? "walk-in" : origin;
  return (
    <span className={cn("rounded-full px-2 py-1 text-[11px]", map[origin])}>
      {label}
    </span>
  );
}

const EXTEND_OPTS = [0.5, 1, 1.5, 2, 3];

function ExtendRow({
  b,
  busy,
  onConfirm,
  onClose,
}: {
  b: Booking;
  busy: boolean;
  onConfirm: (addHours: number, paid: boolean) => void;
  onClose: () => void;
}) {
  const [add, setAdd] = useState(1);
  const [paid, setPaid] = useState(true);
  const extra = priceFor(add);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <span className="mb-1 block text-[11px] text-mist">
          Overstay — extra time played
        </span>
        <div className="flex gap-1.5">
          {EXTEND_OPTS.map((h) => (
            <button
              key={h}
              onClick={() => setAdd(h)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                add === h
                  ? "border-teal bg-teal/15 text-white"
                  : "border-white/10 text-mist hover:border-white/25",
              )}
            >
              +{durLabel(h)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-mist">
        Adds <span className="text-white">{formatLKR(extra)}</span> ·{" "}
        {durLabel(b.durationHrs)} → {durLabel(b.durationHrs + add)} · new total{" "}
        <span className="text-white">{formatLKR(b.totalAmount + extra)}</span>
      </p>
      <label className="flex items-center gap-2 text-xs text-mist">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        Extra collected
      </label>
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => onConfirm(add, paid)}
          className="btn-primary px-4 py-2 text-xs"
        >
          Add &amp; charge
        </button>
        <button onClick={onClose} className="btn-ghost px-3 py-2 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

function OpenSessionCard({
  b,
  busy,
  onEnd,
  onCancel,
}: {
  b: Booking;
  busy: boolean;
  onEnd: (p: {
    checkedOutAt: string;
    totalAmount: number;
    paymentStatus: "paid" | "unpaid";
  }) => void;
  onCancel: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [ending, setEnding] = useState(false);
  const [leftAt, setLeftAt] = useState(localDT());
  const [amount, setAmount] = useState<string>("");
  const [paid, setPaid] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const inAt = b.checkedInAt ? new Date(b.checkedInAt) : new Date();
  const endDate = ending ? new Date(leftAt) : new Date();
  const mins = Math.max(0, (endDate.getTime() - inAt.getTime()) / 60000);
  const billHrs = billableHours(mins);
  const suggested = priceFor(billHrs);

  return (
    <div className="rounded-2xl border border-teal/30 bg-teal/[0.05] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold text-white">
            {b.tableName}
          </p>
          <p className="mt-0.5 text-xs text-mist">
            {b.customerName} · party {b.partySize}
            {b.phone ? ` · ${b.phone}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-teal/15 px-2 py-1 text-[11px] text-teal">
          live
        </span>
      </div>
      <p className="mt-2 text-xs text-mist">
        Seated {timeAgo(b.checkedInAt!)} ({label12h(b.startTime)}) ·{" "}
        {Math.round(mins)} min so far · bill ≈{" "}
        <span className="text-white">{formatLKR(suggested)}</span> ({durLabel(billHrs)})
      </p>

      {!ending ? (
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy}
            onClick={() => {
              setLeftAt(localDT());
              setAmount(String(suggested));
              setEnding(true);
            }}
            className="btn-primary px-4 py-2 text-xs"
          >
            End &amp; bill
          </button>
          <button
            disabled={busy}
            onClick={onCancel}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Cancel session
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-mist">Leaving time</span>
            <input
              type="datetime-local"
              value={leftAt}
              onChange={(e) => setLeftAt(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-mist">
              Amount to charge (LKR) · suggested {formatLKR(suggested)}
            </span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-mist">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 accent-teal"
            />
            Payment collected
          </label>
          <div className="flex gap-2 pt-1">
            <button
              disabled={busy}
              onClick={() =>
                onEnd({
                  checkedOutAt: leftAt,
                  totalAmount: Number(amount),
                  paymentStatus: paid ? "paid" : "unpaid",
                })
              }
              className="btn-primary px-4 py-2 text-xs"
            >
              Confirm checkout
            </button>
            <button
              onClick={() => setEnding(false)}
              className="btn-ghost px-3 py-2 text-xs"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignForm({
  tables,
  players,
  busy,
  onSubmit,
}: {
  tables: TableLite[];
  players: PlayerLite[];
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"session" | "logged" | "booking">("session");
  const [tableId, setTableId] = useState("");
  const [party, setParty] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState(localDate());
  const [start, setStart] = useState("");
  const [dur, setDur] = useState(2);
  const [startAt, setStartAt] = useState(hourAgoDT());
  const [endAt, setEndAt] = useState(localDT());
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(true);
  const [ok, setOk] = useState<string | null>(null);

  const slots = useMemo(() => slotStartsForDate(date), [date]);
  // derive effective values so we never have to sync defaults in an effect
  const effTableId = tableId || tables[0]?.id || "";
  const effStart = slots.includes(start) ? start : slots[0] ?? "";

  const loggedMins =
    mode === "logged" && startAt && endAt
      ? (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000
      : 0;
  const loggedSuggest = loggedMins > 0 ? priceFor(billableHours(loggedMins)) : 0;

  const canSubmit =
    !!effTableId &&
    name.trim().length >= 2 &&
    party >= 1 &&
    (mode === "session" ||
      (mode === "logged" && loggedMins > 0) ||
      (mode === "booking" && !!date && !!effStart));

  async function submit() {
    setOk(null);
    const base: Record<string, unknown> = {
      mode,
      tableId: effTableId,
      partySize: party,
      customerName: name.trim(),
      phone: phone.trim() || undefined,
      playerId: playerId || undefined,
    };
    const body =
      mode === "booking"
        ? { ...base, date, startTime: effStart, durationHrs: dur }
        : mode === "logged"
          ? {
              ...base,
              startAt,
              endAt,
              amount: amount === "" ? undefined : Number(amount),
              paid,
            }
          : base;
    const done = await onSubmit(body);
    if (done) {
      setOk(
        mode === "session"
          ? `Session started for ${name.trim()}.`
          : mode === "logged"
            ? `Visit logged for ${name.trim()}.`
            : `Booking created for ${name.trim()}.`,
      );
      setName("");
      setPhone("");
      setPlayerId("");
      setAmount("");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["session", "logged", "booking"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs transition-colors",
              mode === m
                ? "border-teal bg-teal/15 text-white"
                : "border-white/10 text-mist hover:border-white/25",
            )}
          >
            {m === "session"
              ? "Walk-in — start now"
              : m === "logged"
                ? "Log a past visit"
                : "Reserve a slot"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Table</span>
          <select
            value={effTableId}
            onChange={(e) => setTableId(e.target.value)}
            className="input"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} · {t.area} · {t.seats} seats
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Party size</span>
          <input
            type="number"
            min={1}
            max={30}
            value={party}
            onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))}
            className="input"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">
            Registered player (optional)
          </span>
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              const p = players.find((x) => x.id === e.target.value);
              if (p) setName(p.fullName);
            }}
            className="input"
          >
            <option value="">— walk-in / not registered —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.nickname})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Customer name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name on the session"
            className="input"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Phone (optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07X XXX XXXX"
            inputMode="tel"
            className="input"
          />
        </label>

        {mode === "booking" && (
          <>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">Start</span>
              <select
                value={effStart}
                onChange={(e) => setStart(e.target.value)}
                className="input"
              >
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {label12h(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">
                Length · {formatLKR(priceFor(dur))}
              </span>
              <select
                value={dur}
                onChange={(e) => setDur(Number(e.target.value))}
                className="input"
              >
                {DURATION_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {durLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {mode === "logged" && (
          <>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">Started</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">Left</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mist">
                Charge (LKR){" "}
                {loggedSuggest > 0 && (
                  <span className="text-mist/70">
                    · suggested {formatLKR(loggedSuggest)} (
                    {loggedMins > 0 ? Math.round(loggedMins) : 0} min)
                  </span>
                )}
              </span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={loggedSuggest > 0 ? String(loggedSuggest) : "auto"}
                className="input"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-xs text-mist">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              Payment collected
            </label>
          </>
        )}
      </div>

      {ok && <p className="mt-3 text-xs text-teal">{ok}</p>}

      <button
        disabled={busy || !canSubmit}
        onClick={submit}
        className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-40"
      >
        {mode === "session"
          ? "Start session"
          : mode === "logged"
            ? "Log visit"
            : "Create booking"}
      </button>
    </div>
  );
}

/* ===================== finance ===================== */

type FinPartner = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  username: string | null;
  positions: string[];
};

const PARTNER_POSITION_LABELS: Record<string, string> = {
  director: "Director",
  it_admin: "IT Admin",
  secretary: "Secretary",
  marketing: "Marketing",
  treasurer: "Treasurer",
};
const PARTNER_POSITION_ORDER = [
  "director",
  "it_admin",
  "secretary",
  "marketing",
  "treasurer",
];
type FinContribution = {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  note: string;
  at: string;
};
type FinExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  source: "capital" | "revenue";
  spentAt: string;
  hasReceipt: boolean;
};
type FinCashDay = {
  date: string;
  openingAmount: number | null;
  openingType: string;
  openingNote: string;
  closingAmount: number | null;
  closingType: string;
  closingNote: string;
};
type FinSummary = {
  capitalContributed: number;
  capitalSpent: number;
  capitalBalance: number;
  revenueGross: number;
  revenueCollected: number;
  revenueSpent: number;
  operatingBalance: number;
  businessBalance: number;
  expensesTotal: number;
  partners: { id: string; name: string; contributed: number; pct: number }[];
  daily: {
    date: string;
    revenueGross: number;
    revenueCollected: number;
    expenses: number;
    bookings: number;
  }[];
};
type FinanceData = {
  partners: FinPartner[];
  contributions: FinContribution[];
  expenses: FinExpense[];
  cashDays: FinCashDay[];
  summary: FinSummary;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

async function fileToDataUrl(
  file: File,
  maxDim = 1400,
  quality = 0.72,
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("bad image"));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FinanceTab({
  headers,
  readOnly = false,
  canManageRoster,
}: {
  headers: Record<string, string>;
  readOnly?: boolean;
  /** add / rename / remove partners + manage their logins. Admin only;
   *  defaults to !readOnly (the admin console). Partners never get this. */
  canManageRoster?: boolean;
}) {
  const manageRoster = canManageRoster ?? !readOnly;
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/staff/finance", { headers, cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setData(d);
          setError(null);
        } else setError(d.error || "Failed to load");
      })
      .catch(() => setError("Failed to load"));
  }, [headers]);
  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(
    async (
      method: "POST" | "PATCH" | "DELETE",
      payload: Record<string, unknown> | string,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const res =
          method === "DELETE"
            ? await fetch(`/api/staff/finance?${payload as string}`, {
                method,
                headers,
              })
            : await fetch("/api/staff/finance", {
                method,
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Action failed");
        load();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [headers, load],
  );

  if (!data)
    return (
      <p className="text-sm text-mist">{error ?? "Loading finance…"}</p>
    );
  const s = data.summary;

  return (
    <div className="space-y-9">
      {error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {/* overview */}
      <section>
        <SectionHead
          title="Overview"
          sub="Capital is what the partners put in; the operating side is booking revenue minus day-to-day costs."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat k="Capital in" v={formatLKR(s.capitalContributed)} />
          <MiniStat k="Capital spent" v={formatLKR(s.capitalSpent)} />
          <MiniStat k="Capital balance" v={formatLKR(s.capitalBalance)} />
          <MiniStat k="Revenue (gross)" v={formatLKR(s.revenueGross)} />
          <MiniStat k="Revenue collected" v={formatLKR(s.revenueCollected)} />
          <MiniStat k="Spent from revenue" v={formatLKR(s.revenueSpent)} />
          <MiniStat k="Operating balance" v={formatLKR(s.operatingBalance)} />
          <MiniStat k="Business balance" v={formatLKR(s.businessBalance)} />
        </div>
      </section>

      {/* partners */}
      <section>
        <SectionHead
          title="Partners & capital"
          sub="The four owners, what each has put in, and the resulting ownership split."
        />
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
              <tr>
                {["Partner", "Contributed", "Ownership", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {data.partners.map((p) => {
                const pos = s.partners.find((x) => x.id === p.id);
                return (
                  <tr key={p.id} className="text-white/90">
                    <td className="px-4 py-2.5">
                      {manageRoster ? (
                        <PartnerName
                          name={p.name}
                          busy={busy}
                          onSave={(name) =>
                            send("PATCH", { kind: "partner", id: p.id, name })
                          }
                        />
                      ) : (
                        <span className="text-white/90">{p.name}</span>
                      )}
                      {p.positions.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {[...p.positions]
                            .sort(
                              (a, b) =>
                                PARTNER_POSITION_ORDER.indexOf(a) -
                                PARTNER_POSITION_ORDER.indexOf(b),
                            )
                            .map((pos) => (
                              <span
                                key={pos}
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px]",
                                  pos === "treasurer"
                                    ? "bg-teal/15 text-teal"
                                    : "bg-white/10 text-mist",
                                )}
                              >
                                {PARTNER_POSITION_LABELS[pos] ?? pos}
                              </span>
                            ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {formatLKR(pos?.contributed ?? 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-12 tabular-nums">
                          {(pos?.pct ?? 0).toFixed(1)}%
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span
                            className="block h-full bg-teal"
                            style={{ width: `${pos?.pct ?? 0}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {manageRoster && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `Remove ${p.name}? Their contributions go too.`,
                              )
                            )
                              send("DELETE", `kind=partner&id=${p.id}`);
                          }}
                          className="text-[11px] text-rose-300/80 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ContribForm
              partners={data.partners}
              busy={busy}
              onSubmit={(body) =>
                send("POST", { kind: "contribution", ...body })
              }
            />
            {manageRoster && (
              <AddPartnerForm
                busy={busy}
                onSubmit={(name) => send("POST", { kind: "partner", name })}
              />
            )}
          </div>
        )}
        {manageRoster && (
          <PartnerAccessPanel
            partners={data.partners}
            headers={headers}
            onSaved={load}
          />
        )}

        {data.contributions.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
                <tr>
                  {["Date", "Partner", "Amount", "Note", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {data.contributions.map((c) => (
                  <tr key={c.id} className="text-white/90">
                    <td className="px-4 py-2.5">{c.at}</td>
                    <td className="px-4 py-2.5">{c.partnerName}</td>
                    <td className="px-4 py-2.5">{formatLKR(c.amount)}</td>
                    <td className="px-4 py-2.5 text-mist">{c.note || "—"}</td>
                    <td className="px-4 py-2.5">
                      {!readOnly && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            send("DELETE", `kind=contribution&id=${c.id}`)
                          }
                          className="text-[11px] text-rose-300/80 hover:text-rose-200"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* expenses */}
      <section>
        <SectionHead
          title="Expenses"
          sub="Each expense reduces either the capital balance or the operating (revenue) balance — you choose. Attach the bill or receipt."
        />
        {!readOnly && (
          <ExpenseForm
            busy={busy}
            onSubmit={(body) => send("POST", { kind: "expense", ...body })}
          />
        )}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
              <tr>
                {[
                  "Date",
                  "Category",
                  "Description",
                  "Amount",
                  "From",
                  "Receipt",
                  "",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {data.expenses.map((e) => (
                <tr key={e.id} className="text-white/90">
                  <td className="px-3 py-2.5">{e.spentAt}</td>
                  <td className="px-3 py-2.5">{e.category}</td>
                  <td className="px-3 py-2.5 text-mist">
                    {e.description || "—"}
                  </td>
                  <td className="px-3 py-2.5">{formatLKR(e.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[11px]",
                        e.source === "capital"
                          ? "bg-indigo-400/15 text-indigo-200"
                          : "bg-teal/15 text-teal",
                      )}
                    >
                      {e.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {e.hasReceipt ? (
                      <a
                        href={`/api/staff/finance/receipt?id=${e.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-teal hover:text-teal-bright"
                      >
                        view
                      </a>
                    ) : (
                      <span className="text-[11px] text-mist/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {!readOnly && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (confirm("Delete this expense?"))
                            send("DELETE", `kind=expense&id=${e.id}`);
                        }}
                        className="text-[11px] text-rose-300/80 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-mist">
                    No expenses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* daily cash & income */}
      <section>
        <SectionHead
          title="Daily cash & income"
          sub="Log the cash drawer when you open and close, and see each day's booking income against expenses."
        />
        {!readOnly && (
          <CashForm
            busy={busy}
            onSubmit={(body) => send("POST", { kind: "cash", ...body })}
          />
        )}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
              <tr>
                {[
                  "Date",
                  "Open cash",
                  "Close cash",
                  "Revenue",
                  "Collected",
                  "Expenses",
                  "Net (collected − exp.)",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {mergeDaily(data.cashDays, s.daily).map((row) => (
                <tr key={row.date} className="text-white/90">
                  <td className="px-3 py-2.5">{row.date}</td>
                  <td className="px-3 py-2.5">
                    {row.openingAmount == null ? (
                      <span className="text-mist/50">—</span>
                    ) : (
                      <>
                        {formatLKR(row.openingAmount)}
                        {row.openingType && (
                          <span className="text-mist"> · {row.openingType}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.closingAmount == null ? (
                      <span className="text-mist/50">—</span>
                    ) : (
                      <>
                        {formatLKR(row.closingAmount)}
                        {row.closingType && (
                          <span className="text-mist"> · {row.closingType}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{formatLKR(row.revenueGross)}</td>
                  <td className="px-3 py-2.5">
                    {formatLKR(row.revenueCollected)}
                  </td>
                  <td className="px-3 py-2.5">{formatLKR(row.expenses)}</td>
                  <td className="px-3 py-2.5">
                    {formatLKR(row.revenueCollected - row.expenses)}
                  </td>
                </tr>
              ))}
              {mergeDaily(data.cashDays, s.daily).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-mist">
                    Nothing logged in the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function mergeDaily(
  cash: FinCashDay[],
  daily: FinSummary["daily"],
): (FinCashDay & FinSummary["daily"][number])[] {
  const map = new Map<
    string,
    FinCashDay & FinSummary["daily"][number]
  >();
  const blankCash = {
    openingAmount: null as number | null,
    openingType: "",
    openingNote: "",
    closingAmount: null as number | null,
    closingType: "",
    closingNote: "",
  };
  const blankDaily = {
    revenueGross: 0,
    revenueCollected: 0,
    expenses: 0,
    bookings: 0,
  };
  for (const d of daily) map.set(d.date, { ...blankCash, ...d });
  for (const c of cash) {
    const cur = map.get(c.date);
    if (cur) Object.assign(cur, c);
    else map.set(c.date, { ...blankDaily, ...c });
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function PartnerAccessPanel({
  partners,
  headers,
  onSaved,
}: {
  partners: FinPartner[];
  headers: Record<string, string>;
  onSaved: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs font-medium text-white">Partner logins & positions</p>
      <p className="mt-1 text-[11px] text-mist">
        Give a partner a username + password to sign in at{" "}
        <span className="text-mist/80">/partners</span>. A partner with the{" "}
        <span className="text-teal">Treasurer</span> position can edit finance;
        any other signed-in partner sees it read-only.
      </p>
      <div className="mt-3 space-y-3">
        {partners.map((p) => (
          <PartnerAccessRow
            key={p.id}
            partner={p}
            headers={headers}
            onSaved={onSaved}
          />
        ))}
        {partners.length === 0 && (
          <p className="text-[11px] text-mist">Add a partner first.</p>
        )}
      </div>
    </div>
  );
}

function PartnerAccessRow({
  partner,
  headers,
  onSaved,
}: {
  partner: FinPartner;
  headers: Record<string, string>;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(partner.username ?? "");
  const [password, setPassword] = useState("");
  const [positions, setPositions] = useState<string[]>(partner.positions ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (pos: string) =>
    setPositions((cur) =>
      cur.includes(pos) ? cur.filter((x) => x !== pos) : [...cur, pos],
    );

  const dirty =
    username !== (partner.username ?? "") ||
    password.length > 0 ||
    positions.slice().sort().join() !==
      (partner.positions ?? []).slice().sort().join();

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: partner.id,
          username,
          positions,
          ...(password ? { password } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setPassword("");
      setMsg("Saved");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[120px] text-sm text-white/90">
          {partner.name}
        </span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="input h-8 w-36 text-xs"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={partner.username ? "new password" : "set password"}
          type="text"
          autoComplete="off"
          className="input h-8 w-40 text-xs"
        />
        <button
          disabled={busy || !dirty}
          onClick={save}
          className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-[11px] text-teal">{msg}</span>}
        {err && <span className="text-[11px] text-rose-300">{err}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PARTNER_POSITION_ORDER.map((pos) => (
          <label
            key={pos}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
              positions.includes(pos)
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-white/10 text-mist",
            )}
          >
            <input
              type="checkbox"
              className="h-3 w-3 accent-teal"
              checked={positions.includes(pos)}
              onChange={() => toggle(pos)}
            />
            {PARTNER_POSITION_LABELS[pos]}
          </label>
        ))}
      </div>
    </div>
  );
}

function PartnerName({
  name,
  busy,
  onSave,
}: {
  name: string;
  busy: boolean;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(name);
  if (!editing)
    return (
      <button
        onClick={() => {
          setV(name);
          setEditing(true);
        }}
        className="text-left hover:text-teal"
      >
        {name}
        <span className="ml-1.5 text-[10px] text-mist">edit</span>
      </button>
    );
  return (
    <span className="flex items-center gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="input h-8 w-40 py-1"
        autoFocus
      />
      <button
        disabled={busy || v.trim().length < 2}
        onClick={() => {
          onSave(v.trim());
          setEditing(false);
        }}
        className="text-[11px] text-teal"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-[11px] text-mist"
      >
        ✕
      </button>
    </span>
  );
}

function ContribForm({
  partners,
  busy,
  onSubmit,
}: {
  partners: FinPartner[];
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [partnerId, setPartnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(localDate());
  const [note, setNote] = useState("");
  const eff = partnerId || partners[0]?.id || "";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-3 text-xs font-medium text-white">Add a capital contribution</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Partner</span>
          <select
            value={eff}
            onChange={(e) => setPartnerId(e.target.value)}
            className="input"
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Amount (LKR)</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Date</span>
          <input
            type="date"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. seed money, equipment top-up"
            className="input"
          />
        </label>
      </div>
      <button
        disabled={busy || !eff || !(Number(amount) > 0)}
        onClick={async () => {
          const ok = await onSubmit({
            partnerId: eff,
            amount: Number(amount),
            at,
            note: note.trim() || undefined,
          });
          if (ok) {
            setAmount("");
            setNote("");
          }
        }}
        className="btn-primary mt-3 px-4 py-2 text-xs disabled:opacity-40"
      >
        Add contribution
      </button>
    </div>
  );
}

function AddPartnerForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-3 text-xs font-medium text-white">Add another partner</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Partner name"
          className="input flex-1"
        />
        <button
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            const ok = await onSubmit(name.trim());
            if (ok) setName("");
          }}
          className="btn-ghost px-4 py-2 text-xs disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ExpenseForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"revenue" | "capital">("revenue");
  const [spentAt, setSpentAt] = useState(localDate());
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

  const effectiveCategory =
    category === OTHER_CATEGORY ? customCategory.trim() : category;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-3 text-xs font-medium text-white">Record an expense</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            <option value="">Pick a category…</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {category === OTHER_CATEGORY && (
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Type the category"
              className="input mt-2"
            />
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Amount (LKR)</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-mist">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Date</span>
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input"
          />
        </label>
        <div className="block">
          <span className="mb-1 block text-[11px] text-mist">Reduce from</span>
          <div className="flex gap-2">
            {(["revenue", "capital"] as const).map((sv) => (
              <button
                key={sv}
                onClick={() => setSource(sv)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs transition-colors",
                  source === sv
                    ? "border-teal bg-teal/15 text-white"
                    : "border-white/10 text-mist hover:border-white/25",
                )}
              >
                {sv === "revenue" ? "Revenue" : "Initial capital"}
              </button>
            ))}
          </div>
        </div>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-mist">
            Receipt / bill — photo or PDF (optional)
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setImgErr(null);
              setReceipt(null);
              setReceiptName(null);
              if (!f) return;
              try {
                const isPdf =
                  f.type === "application/pdf" ||
                  f.name.toLowerCase().endsWith(".pdf");
                let d = isPdf
                  ? await readFileAsDataUrl(f)
                  : await fileToDataUrl(f);
                if (isPdf && !d.startsWith("data:application/pdf")) {
                  const i = d.indexOf(";base64,");
                  if (i === -1) {
                    setImgErr("Couldn't read that PDF.");
                    return;
                  }
                  d = "data:application/pdf" + d.slice(i);
                }
                if (d.length > 7_800_000) {
                  setImgErr(
                    isPdf
                      ? "PDF is too large — keep it under ~6MB."
                      : "Image too large after compression — use a smaller photo.",
                  );
                  return;
                }
                setReceipt(d);
                setReceiptName(f.name);
              } catch {
                setImgErr("Couldn't read that file.");
              }
            }}
            className="block w-full text-xs text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
          />
          {receipt && (
            <span className="mt-1 block text-[11px] text-teal">
              Attached ✓ {receiptName ? `— ${receiptName}` : ""}
            </span>
          )}
          {imgErr && (
            <span className="mt-1 block text-[11px] text-rose-300">
              {imgErr}
            </span>
          )}
        </label>
      </div>
      <button
        disabled={busy || !effectiveCategory || !(Number(amount) > 0)}
        onClick={async () => {
          const ok = await onSubmit({
            category: effectiveCategory,
            description: description.trim() || undefined,
            amount: Number(amount),
            source,
            spentAt,
            receiptImage: receipt || undefined,
          });
          if (ok) {
            setCategory("");
            setCustomCategory("");
            setDescription("");
            setAmount("");
            setReceipt(null);
            setReceiptName(null);
          }
        }}
        className="btn-primary mt-3 px-4 py-2 text-xs disabled:opacity-40"
      >
        Add expense
      </button>
    </div>
  );
}

function CashForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [date, setDate] = useState(localDate());
  const [phase, setPhase] = useState<"open" | "close">("open");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex gap-2">
        {(["open", "close"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs transition-colors",
              phase === p
                ? "border-teal bg-teal/15 text-white"
                : "border-white/10 text-mist hover:border-white/25",
            )}
          >
            {p === "open" ? "Opening balance" : "Closing balance"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Amount (LKR)</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Type</span>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="float, drawer count…"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
          />
        </label>
      </div>
      <button
        disabled={busy || !(Number(amount) >= 0) || amount === ""}
        onClick={async () => {
          const ok = await onSubmit({
            date,
            phase,
            amount: Number(amount),
            type: type.trim() || undefined,
            note: note.trim() || undefined,
          });
          if (ok) {
            setAmount("");
            setType("");
            setNote("");
          }
        }}
        className="btn-primary mt-3 px-4 py-2 text-xs disabled:opacity-40"
      >
        Save {phase === "open" ? "opening" : "closing"} balance
      </button>
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="font-display text-xl font-bold text-white">{v}</div>
      <div className="mt-0.5 text-[11px] text-mist">{k}</div>
    </div>
  );
}
