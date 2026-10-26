"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "./Primitives";
import { AccountsApp } from "./accounts/AccountsApp";
import type { OfficialListItem } from "@/lib/friends/types";
import { cn, formatDateShort, label12h, timeAgo } from "@/lib/utils";
import {
  DURATION_OPTIONS,
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
  | "campaign"
  | "security"
  | "audit";

type VenueTable = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  sortOrder: number;
  active: boolean;
  bookable: boolean;
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
            { value: "matches", label: "Record a match" },
            { value: "players", label: "Players" },
            { value: "tournaments", label: "Tournaments" },
            { value: "promotions", label: "Offers" },
            { value: "membership", label: "Membership" },
            { value: "tables", label: "Tables" },
            { value: "bookings", label: "Bookings" },
            ...(me?.role === "admin"
              ? [
                  { value: "finance", label: "Accounts" },
                  { value: "campaign", label: "Campaign" },
                ]
              : []),
            { value: "audit", label: "Audit" },
            ...(isStaff ? [{ value: "security", label: "Security" }] : []),
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      <div className="mt-8">
        {tab === "matches" && <MatchTab headers={headers} />}
        {tab === "players" && <PlayersTab headers={headers} isAdmin={me?.role === "admin"} />}
        {tab === "tournaments" && <TournamentsTab headers={headers} />}
        {tab === "promotions" && <PromotionsTab headers={headers} />}
        {tab === "membership" && <MembershipTab headers={headers} isAdmin={me?.role === "admin"} />}
        {tab === "tables" && <TablesTab headers={headers} />}
        {tab === "bookings" && <BookingsTab headers={headers} />}
        {tab === "finance" &&
          (me?.role === "admin" ? (
            <AccountsApp headers={headers} />
          ) : (
            <p className="text-sm text-mist">Accounts are admin-only.</p>
          ))}
        {tab === "campaign" && me?.role === "admin" && <CampaignCodeTab />}
        {tab === "audit" && <AuditTab headers={headers} />}
        {tab === "security" && isStaff && <SecurityTab />}
      </div>
    </div>
  );
}

/* ================= Security: two-step sign-in (staff & admins) ================= */

function SecurityTab() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/me/2fa", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(null));
  }, []);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || "Could not save" });
      return null;
    }
    return d;
  }

  async function signOutEverywhere() {
    if (!window.confirm("Sign out of Cue Point on every device, including this one?")) return;
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ everywhere: true }),
    });
    router.push("/account");
    router.refresh();
  }

  const codeInput = (
    <Field label="6-digit code from the app">
      <input
        className="input w-40 tracking-[0.3em] tabular-nums"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </Field>
  );

  return (
    <div className="space-y-6">
      <Panel title="Two-step sign-in">
        <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-mist">
          After your password, sign-in also asks for a 6-digit code from an authenticator app on your phone
          (Google Authenticator, Microsoft Authenticator, 1Password…). A stolen password alone then can&rsquo;t
          get into the console or the accounts.
        </p>
        <p className="mb-4 text-sm text-white">
          Status:{" "}
          <span className={enabled ? "font-semibold text-teal" : "font-semibold text-[#ffc98f]"}>
            {enabled == null ? "…" : enabled ? "On" : "Off"}
          </span>
        </p>
        <Msg msg={msg} />

        {enabled === false && !setup && (
          <button
            disabled={busy}
            onClick={async () => {
              const d = await call({ action: "setup" });
              if (d) setSetup(d);
            }}
            className="btn-primary mt-3 px-5 py-2.5 text-sm disabled:opacity-40"
          >
            Set up two-step sign-in
          </button>
        )}

        {enabled === false && setup && (
          <div className="mt-3 space-y-4">
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-mist">
              <li>Open your authenticator app and add an account.</li>
              <li>
                On this phone,{" "}
                <a href={setup.uri} className="font-medium text-teal underline">
                  tap here to add it
                </a>
                , or choose &ldquo;enter a setup key&rdquo; and type:
              </li>
            </ol>
            <p className="select-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm tracking-widest text-white">
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </p>
            <p className="text-[13px] text-mist">3. Enter the code the app shows to finish.</p>
            <div className="flex flex-wrap items-end gap-3">
              {codeInput}
              <button
                disabled={busy || code.length !== 6}
                onClick={async () => {
                  const d = await call({ action: "enable", code });
                  if (d) {
                    setEnabled(true);
                    setSetup(null);
                    setCode("");
                    setMsg({ ok: true, text: "Two-step sign-in is on. Other devices were signed out." });
                  }
                }}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
              >
                Turn on
              </button>
            </div>
          </div>
        )}

        {enabled && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {codeInput}
            <button
              disabled={busy || code.length !== 6}
              onClick={async () => {
                if (!window.confirm("Turn off two-step sign-in? Your account will be protected by the password only.")) return;
                const d = await call({ action: "disable", code });
                if (d) {
                  setEnabled(false);
                  setCode("");
                  setMsg({ ok: true, text: "Two-step sign-in is off." });
                }
              }}
              className="btn-ghost px-5 py-2.5 text-sm disabled:opacity-40"
            >
              Turn off
            </button>
          </div>
        )}
      </Panel>

      <Panel title="Signed-in devices">
        <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-mist">
          Lost a phone, or signed in on a shared computer? End every session on your account at once.
        </p>
        <button onClick={signOutEverywhere} className="btn-ghost px-5 py-2.5 text-sm">
          Sign out all devices
        </button>
      </Panel>
    </div>
  );
}

/* ================= Campaign pass code (admins) ================= */

function CampaignCodeTab() {
  const [isSet, setIsSet] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/staff/campaign-code", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsSet(!!d.set))
      .catch(() => setIsSet(null));
  }, []);

  async function save(next: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/staff/campaign-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: next }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Could not save" });
    setIsSet(!!d.set);
    setCode("");
    setAgain("");
    setMsg({ ok: true, text: d.set ? "Pass code saved." : "Pass code removed." });
  }

  const valid = /^\d{4,8}$/.test(code) && code === again;

  return (
    <Panel title="Campaign pass code">
      <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-mist">
        Players can&rsquo;t record their own Campaign Mode results. After you watch a
        player finish, they hand you their phone and you enter this code to approve
        it. The code is yours alone; approvals are logged under your name. Don&rsquo;t
        use your login password.
      </p>
      <p className="mb-4 text-sm text-white">
        Status:{" "}
        <span className={isSet ? "font-semibold text-teal" : "font-semibold text-[#ffc98f]"}>
          {isSet == null ? "…" : isSet ? "You have a pass code set" : "No pass code set yet"}
        </span>
      </p>
      <Msg msg={msg} />
      <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
        <Field label={isSet ? "New pass code (4 to 8 digits)" : "Pass code (4 to 8 digits)"}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </Field>
        <Field label="Type it again">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="input"
            value={again}
            onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </Field>
      </div>
      {code.length > 0 && again.length > 0 && code !== again && (
        <p className="mt-2 text-xs text-rose-200">The two codes don&rsquo;t match.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => save(code)}
          disabled={busy || !valid}
          className="btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSet ? "Change pass code" : "Set pass code"}
        </button>
        {isSet && (
          <button
            onClick={() => {
              if (window.confirm("Remove your pass code? You won't be able to approve campaign results until you set a new one."))
                void save("");
            }}
            disabled={busy}
            className="btn-ghost px-5 py-2.5 text-sm"
          >
            Remove
          </button>
        )}
      </div>
    </Panel>
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
    winnerId;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await jpost("/api/staff/matches", headers, {
        type: form.type,
        playerAId: form.playerAId,
        playerBId: form.playerBId,
        tableName: form.tableName,
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
      <Panel title="Record a ranked or casual match">
        <p className="-mt-1 mb-4 text-[12px] text-mist">
          Tournament matches are entered inside each tournament — open it from the{" "}
          <strong>Tournaments</strong> tab.
        </p>
        {list.length < 2 ? (
          <p className="text-[13px] text-mist">
            You need at least two players. Add them in the{" "}
            <strong>Players</strong> tab first.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Match type">
              <div className="flex gap-2">
                {(["ranked", "casual"] as MatchType[]).map((t) => (
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
                  Updates matches, W/L, win %, ranking points &amp; positions
                  and recent form. Audited.
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

function PlayersTab({
  headers,
  isAdmin,
}: {
  headers: Record<string, string>;
  isAdmin: boolean;
}) {
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
                disabled={!isAdmin}
                title={isAdmin ? undefined : "Only an admin can set a paid membership"}
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
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : "Only an admin can change membership"}
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
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : "Only an admin can change roles"}
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

/* Official tournaments run on the same engine as friend tournaments: the
   same four-step setup and every format, and results are entered on each
   tournament's own page — staff run them from there. */
function TournamentsTab({ headers }: { headers: Record<string, string> }) {
  const { data: list } = useStaffData(
    "/api/tournaments",
    headers,
    (d) => d.tournaments as OfficialListItem[],
  );
  const groups: [string, OfficialListItem[]][] = [
    ["Playing now", (list ?? []).filter((t) => t.status === "in_progress")],
    ["Sign-up", (list ?? []).filter((t) => t.status === "registration_open")],
    ["Finished", (list ?? []).filter((t) => t.status === "completed")],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-teal/30 bg-teal/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-white">Run an official tournament</p>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Same steps and formats as a friends tournament — knockout, two lives, league or groups, match
            length per round — plus entry fee, prize pool and rules. Players sign up on its page, and you
            start it and enter every result right there.
          </p>
        </div>
        <Link href="/admin/tournaments/new" className="btn-primary shrink-0 px-6 py-3 text-sm">
          ＋ Create tournament
        </Link>
      </div>

      {list && list.length === 0 && <p className="text-sm text-mist">No official tournaments yet.</p>}
      {groups
        .filter(([, ts]) => ts.length)
        .map(([title, ts]) => (
          <Panel key={title} title={`${title} (${ts.length})`}>
            <div className="space-y-3">
              {ts.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.slug}`}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-teal/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="mt-0.5 text-[12px] text-mist">
                      {t.formatLine} · {t.registered}/{t.capacity} players
                      {t.startAt ? ` · ${formatDateShort(t.startAt)}` : ""}
                      {t.champion ? ` · 🏆 ${t.champion.nickname}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-teal">
                    {t.status === "in_progress"
                      ? "Enter results →"
                      : t.status === "registration_open"
                        ? "Players & start →"
                        : "Results →"}
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        ))}
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

function MembershipTab({
  headers,
  isAdmin,
}: {
  headers: Record<string, string>;
  isAdmin: boolean;
}) {
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
      {!isAdmin && (
        <p className="mb-3 text-[12px] text-[#ffc98f]">
          View only. Membership plans and players&rsquo; memberships can be changed by an admin.
        </p>
      )}
      <div
        className={`mt-3 grid gap-4 sm:grid-cols-3 ${isAdmin ? "" : "pointer-events-none opacity-60"}`}
        aria-disabled={!isAdmin}
      >
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
                  : {
                      ok: false,
                      text:
                        res.status === 403
                          ? "Only an admin can change membership plans."
                          : "Update failed",
                    },
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
            onToggleBookable={() =>
              patch(
                t.id,
                { bookable: !t.bookable },
                t.bookable
                  ? `${t.label} — online booking off`
                  : `${t.label} — online booking on`,
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
  onToggleBookable,
  onRemove,
}: {
  table: VenueTable;
  onSave: (patch: Record<string, unknown>) => void;
  onToggle: () => void;
  onToggleBookable: () => void;
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
          onClick={onToggleBookable}
          className={cn(
            "h-8 rounded-lg border px-3 text-xs hover:border-teal/50",
            table.bookable
              ? "border-teal/40 text-teal"
              : "border-white/12 text-mist",
          )}
          title="Whether players can reserve this table online"
        >
          {table.bookable ? "Online: on" : "Online: off"}
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

/* Reservations only: the admin books a slot so customers see it as busy.
   No sessions, prices or payments here — money lives in Accounts. */

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
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function BookingsTab({ headers }: { headers: Record<string, string> }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tables, setTables] = useState<TableLite[]>([]);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [fDate, setFDate] = useState("");
  const [fStatus, setFStatus] = useState("CONFIRMED");
  const [upcoming, setUpcoming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const today = localDate();
  const list = (bookings ?? [])
    .filter((b) => fDate || !upcoming || b.date >= today)
    .sort((a, b) =>
      upcoming && !fDate
        ? (a.date + a.startTime).localeCompare(b.date + b.startTime)
        : 0,
    );

  return (
    <div className="space-y-9">
      {error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <section>
        <SectionHead
          title="Reserve a table"
          sub="Book a slot for a customer — it shows as busy to everyone booking online. No payment is recorded here."
        />
        <ReserveForm
          tables={tables}
          players={players}
          busy={busy}
          onSubmit={(body) => act(body, "POST")}
        />
      </section>

      <section>
        <SectionHead
          title="Bookings"
          sub="Reservations made online by members or here by the admin."
        />
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
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="">All</option>
            </select>
          </label>
          {!fDate && (
            <label className="flex items-center gap-2 pb-2.5 text-xs text-mist">
              <input
                type="checkbox"
                checked={upcoming}
                onChange={(e) => setUpcoming(e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              Upcoming only
            </label>
          )}
          {fDate && (
            <button onClick={() => setFDate("")} className="btn-ghost px-3 py-2 text-xs">
              Clear date
            </button>
          )}
          <button onClick={load} className="btn-ghost px-4 py-2 text-xs">
            Refresh
          </button>
        </div>

        {bookings && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
                <tr>
                  {["Ref", "Table", "When", "Party", "Name", "Phone", "Booked by", "Status", ""].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {list.map((b) => (
                  <tr key={b.id} className="text-white/90">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-teal">
                      {b.reference}
                    </td>
                    <td className="px-3 py-2.5">{b.tableName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {formatDateShort(b.date)} · {label12h(b.startTime)} · {durLabel(b.durationHrs)}
                    </td>
                    <td className="px-3 py-2.5">{b.partySize}</td>
                    <td className="px-3 py-2.5">{b.customerName}</td>
                    <td className="px-3 py-2.5 text-mist">{b.phone || "—"}</td>
                    <td className="px-3 py-2.5">
                      <OriginBadge origin={b.origin} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[11px]",
                          b.status === "CANCELLED"
                            ? "bg-white/10 text-mist"
                            : "bg-teal/15 text-teal",
                        )}
                      >
                        {b.status === "CANCELLED" ? "Cancelled" : "Confirmed"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-3">
                        {b.status !== "CANCELLED" && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Cancel booking ${b.reference}? The slot opens up again.`))
                                act({ id: b.id, action: "cancel" });
                            }}
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
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-mist">
                      No bookings match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
  const online = origin === "online";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[11px]",
        online ? "bg-white/10 text-mist" : "bg-indigo-400/15 text-indigo-200",
      )}
    >
      {online ? "online" : "admin"}
    </span>
  );
}

function ReserveForm({
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
  const [tableId, setTableId] = useState("");
  const [party, setParty] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [date, setDate] = useState(localDate());
  const [start, setStart] = useState("");
  const [dur, setDur] = useState(2);
  const [ok, setOk] = useState<string | null>(null);

  const slots = useMemo(() => slotStartsForDate(date), [date]);
  // derive effective values so we never have to sync defaults in an effect
  const effTableId = tableId || tables[0]?.id || "";
  const effStart = slots.includes(start) ? start : slots[0] ?? "";
  const canSubmit = !!effTableId && name.trim().length >= 2 && party >= 1 && !!date && !!effStart;

  async function submit() {
    setOk(null);
    const done = await onSubmit({
      mode: "booking",
      tableId: effTableId,
      partySize: party,
      customerName: name.trim(),
      phone: phone.trim() || undefined,
      playerId: playerId || undefined,
      date,
      startTime: effStart,
      durationHrs: dur,
    });
    if (done) {
      const t = tables.find((x) => x.id === effTableId);
      setOk(`Booked ${t?.label ?? "table"} for ${name.trim()} · ${formatDateShort(date)} ${label12h(effStart)}.`);
      setName("");
      setPhone("");
      setPlayerId("");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-mist">Table</span>
          <select value={effTableId} onChange={(e) => setTableId(e.target.value)} className="input">
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} · {t.area}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Date</span>
          <input type="date" value={date} min={localDate()} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Start</span>
          <select value={effStart} onChange={(e) => setStart(e.target.value)} className="input">
            {slots.map((s) => (
              <option key={s} value={s}>
                {label12h(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Length</span>
          <select value={dur} onChange={(e) => setDur(Number(e.target.value))} className="input">
            {DURATION_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {durLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Customer name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on the booking" className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Phone (optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07X XXX XXXX" inputMode="tel" className="input" />
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
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="mb-1 block text-[11px] text-mist">Registered player (optional)</span>
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              const p = players.find((x) => x.id === e.target.value);
              if (p) setName(p.fullName);
            }}
            className="input"
          >
            <option value="">— not a registered player —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.nickname})
              </option>
            ))}
          </select>
        </label>
      </div>

      {ok && <p className="mt-3 text-xs text-teal">✓ {ok}</p>}

      <button disabled={busy || !canSubmit} onClick={submit} className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-40">
        Reserve table
      </button>
    </div>
  );
}
