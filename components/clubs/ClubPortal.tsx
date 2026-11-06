"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { PlayerPicker } from "@/components/friends/PlayerPicker";
import { setActAsClub } from "@/components/friends/api";
import { Card, GhostButton, Notice, PrimaryButton } from "@/components/friends/ui";
import type { ClubMemberView, ClubView } from "@/lib/clubs/store";
import {
  bestOfSlots,
  FINISH_LABEL,
  formatLine,
  type LeagueFinish,
  type TournamentSettings,
} from "@/lib/friends/structure";
import { cn } from "@/lib/utils";

/* Club admin portal — built for a phone first: four big tabs, one clear
   action per screen, tap a player for everything you can do with them. */

type Me = { name: string; slug: string; username: string | null; hostId: string };
type Tab = "week" | "groups" | "settings" | "history";
type Act = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

async function post(body: unknown): Promise<{ ok: boolean; view?: ClubView; error?: string }> {
  try {
    const res = await fetch("/api/club/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, view: d.view } : { ok: false, error: d.error || "Something went wrong." };
  } catch {
    return { ok: false, error: "You appear to be offline." };
  }
}

export function ClubPortal() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [view, setView] = useState<ClubView | null>(null);

  const load = useCallback(() => {
    fetch("/api/club/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMe(d.club ?? null);
        setView(d.view ?? null);
      })
      .catch(() => setMe(null));
  }, []);
  useEffect(() => load(), [load]);

  // the player search runs as the club
  useEffect(() => {
    setActAsClub(!!me);
    return () => setActAsClub(false);
  }, [me]);

  if (me === undefined)
    return (
      <Shell>
        <p className="text-sm text-mist">Loading…</p>
      </Shell>
    );
  if (!me || !view)
    return (
      <Shell>
        <Login onDone={load} />
      </Shell>
    );

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-teal">Club admin</p>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-white sm:text-3xl">{me.name}</h1>
          <p className="mt-1 text-xs text-mist">
            <Link href={`/clubs/${me.slug}`} className="underline">
              Public club page
            </Link>
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-mist hover:text-white"
          onClick={async () => {
            await fetch("/api/club/logout", { method: "POST" }).catch(() => {});
            setMe(null);
            setView(null);
          }}
        >
          Sign out
        </button>
      </div>
      <Manage view={view} slug={me.slug} onView={setView} onReload={load} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl space-y-5 px-4 pb-28 pt-24 sm:px-8 sm:pt-28">{children}</div>;
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-sm">
      <p className="text-xs uppercase tracking-[0.28em] text-teal">Partner clubs</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-white">Club admin sign-in</h1>
      <p className="mt-1.5 text-sm text-mist">Use the club username and password Cue Point gave you.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/club/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          }).catch(() => null);
          const d = res ? await res.json().catch(() => ({})) : {};
          setBusy(false);
          if (!res?.ok) return setError(d.error || "Could not sign in.");
          onDone();
        }}
      >
        <input
          className="input w-full"
          placeholder="Username"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="input w-full"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <PrimaryButton className="w-full py-3" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Manage({
  view,
  slug,
  onView,
  onReload,
}: {
  view: ClubView;
  slug: string;
  onView: (v: ClubView) => void;
  onReload: () => void;
}) {
  const [tab, setTab] = useState<Tab>("week");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // a club admin often enters the last result on another screen: refresh on return
  useEffect(() => {
    const onFocus = () => onReload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [onReload]);

  const act: Act = async (body, ok) => {
    setBusy(true);
    setMsg(null);
    const r = await post(body);
    setBusy(false);
    if (!r.ok || !r.view) {
      setMsg({ ok: false, text: r.error ?? "Something went wrong." });
      return false;
    }
    onView(r.view);
    if (ok) setMsg({ ok: true, text: ok });
    return true;
  };

  const total = view.groups.reduce((n, g) => n + g.members.length, 0);
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "week", label: "This week", icon: "🎱" },
    { id: "groups", label: `Players (${total})`, icon: "👥" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "history", label: "History", icon: "🏆" },
  ];

  return (
    <div className="space-y-5">
      <nav className="sticky top-16 z-20 -mx-4 bg-navy-950/90 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setMsg(null);
              }}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[11px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:text-sm",
                tab === t.id
                  ? "border-[#a78bfa]/70 bg-[#a78bfa]/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-mist",
              )}
            >
              <span aria-hidden className="text-base">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}

      {tab === "week" && <ThisWeek view={view} slug={slug} busy={busy} act={act} goGroups={() => setTab("groups")} />}
      {tab === "groups" && <Groups view={view} busy={busy} act={act} />}
      {tab === "settings" && <Settings view={view} busy={busy} act={act} />}
      {tab === "history" && <History view={view} slug={slug} />}
    </div>
  );
}

/* ----------------------------- this week ----------------------------- */

function ThisWeek({
  view,
  slug,
  busy,
  act,
  goGroups,
}: {
  view: ClubView;
  slug: string;
  busy: boolean;
  act: Act;
  goGroups: () => void;
}) {
  const current = view.weeks[0];
  const short = view.groups.filter((g) => g.members.length < 3);
  const name = (g: number) => view.groups.find((x) => x.group === g)?.name ?? `Group ${g}`;

  const startButton = (
    <>
      {short.length > 0 && (
        <p className="text-sm text-red-300">
          {short.map((g) => g.name).join(", ")} need{short.length === 1 ? "s" : ""} at least 3 players.{" "}
          <button type="button" className="underline" onClick={goGroups}>
            Add players
          </button>
        </p>
      )}
      <PrimaryButton
        className="w-full py-3.5 text-base sm:w-auto"
        disabled={busy || short.length > 0}
        onClick={() => act({ action: "start-week" }, `Week ${view.nextWeek} started — the fixtures are out.`)}
      >
        ▶ Start week {view.nextWeek}
      </PrimaryButton>
    </>
  );

  // ---- a week is being played ----
  if (view.running && current) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold text-white">Week {current.week} · being played</h2>
        <p className="text-sm text-mist">Tap a group to start matches and enter who won.</p>
        {current.tournaments.map((t) => {
          const pct = t.total ? Math.round((t.played / t.total) * 100) : 0;
          const done = t.status === "completed" || t.status === "cancelled";
          return (
            <Link
              key={t.id}
              href={`/clubs/${slug}/tournaments/${t.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:bg-white/[0.06]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-semibold text-white">
                  {t.group === 1 ? "★ " : ""}
                  {t.groupName}
                </span>
                <span className={cn("text-sm font-semibold", done ? "text-teal" : "text-[#c4b5fd]")}>
                  {t.status === "completed" ? "Finished ✓" : t.status === "cancelled" ? "Cancelled" : "Open →"}
                </span>
              </span>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#ec4899)]" style={{ width: `${pct}%` }} />
              </span>
              <span className="mt-1.5 block text-xs text-mist">
                {t.played} of {t.total} matches played · {t.players} players
                {t.champion ? ` · 🏆 ${t.champion}` : ""}
              </span>
            </Link>
          );
        })}
        <p className="text-xs text-mist">
          When every group has finished, the groups for next week are made automatically.
        </p>
      </div>
    );
  }

  // ---- last week finished: show what the system did ----
  if (current) {
    const lm = view.lastMoves;
    const up = lm?.moves.filter((m) => m.to < m.from) ?? [];
    const down = lm?.moves.filter((m) => m.to > m.from) ?? [];
    return (
      <div className="space-y-4">
        <Card>
          <h2 className="font-display text-xl font-bold text-white">Week {current.week} finished ✓</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/90">
            {current.tournaments.map((t) => (
              <li key={t.id}>
                {t.groupName}: {t.status === "cancelled" ? "cancelled" : t.champion ? `🏆 ${t.champion}` : "finished"}
              </li>
            ))}
          </ul>
        </Card>

        {lm && (
          <Card>
            <h3 className="font-display text-lg font-bold text-white">
              {lm.undone ? "Group changes undone" : "Groups updated automatically"}
            </h3>
            {lm.undone ? (
              <p className="mt-1 text-sm text-mist">Everyone is back where they were. Move or swap players by hand if needed.</p>
            ) : lm.moves.length ? (
              <>
                <p className="mt-1 text-sm text-mist">From the final standings. Need a change? Swap any two players.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MoveList title="▲ Moved up" tone="text-teal" moves={up} name={name} />
                  <MoveList title="▼ Moved down" tone="text-[#ffb066]" moves={down} name={name} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <GhostButton onClick={goGroups}>⇄ Swap players</GhostButton>
                  <GhostButton
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Put everyone back in their old group?"))
                        void act({ action: "undo-moves" }, "Changes undone — everyone is back in their old group.");
                    }}
                  >
                    Undo changes
                  </GhostButton>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-mist">Nobody moved this time.</p>
            )}
          </Card>
        )}

        <Card className="space-y-3">
          <h3 className="font-display text-lg font-bold text-white">Next: week {view.nextWeek}</h3>
          <GroupCounts view={view} />
          {startButton}
        </Card>
      </div>
    );
  }

  // ---- the very first week ----
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl font-bold text-white">Week 1</h2>
      <p className="text-sm text-mist">
        Starts a league in every group ({formatLine(view.leagueSettings)}). Everyone is put in straight away —
        nobody has to accept.
      </p>
      <GroupCounts view={view} />
      {startButton}
    </Card>
  );
}

function GroupCounts({ view }: { view: ClubView }) {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {view.groups.map((g) => (
        <li
          key={g.group}
          className={cn(
            "rounded-full border px-3 py-1",
            g.members.length < 3 ? "border-red-400/40 text-red-300" : "border-white/15 text-white/90",
          )}
        >
          {g.name}: {g.members.length}
        </li>
      ))}
    </ul>
  );
}

function MoveList({
  title,
  tone,
  moves,
  name,
}: {
  title: string;
  tone: string;
  moves: NonNullable<ClubView["lastMoves"]>["moves"];
  name: (g: number) => string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className={cn("text-sm font-semibold", tone)}>{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-white/90">
        {moves.map((m) => (
          <li key={m.playerId}>
            {m.nickname} <span className="text-mist">→ {name(m.to)}</span>
          </li>
        ))}
        {!moves.length && <li className="text-mist">Nobody</li>}
      </ul>
    </div>
  );
}

/* ----------------------------- players & groups ----------------------------- */

function Groups({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  const [addTo, setAddTo] = useState(view.groupCount);
  const [picked, setPicked] = useState<ClubMemberView | null>(null);
  const [swapFrom, setSwapFrom] = useState<ClubMemberView | null>(null);
  const target = Math.min(addTo, view.groupCount);
  const memberIds = new Set(view.groups.flatMap((g) => g.members.map((m) => m.id)));
  const moved = new Map(
    (view.lastMoves && !view.lastMoves.undone ? view.lastMoves.moves : []).map((m) => [m.playerId, m.to < m.from ? "up" : "down"]),
  );
  const groupName = (g: number) => view.groups.find((x) => x.group === g)?.name ?? `Group ${g}`;

  const tapMember = async (m: ClubMemberView) => {
    if (swapFrom) {
      if (m.id === swapFrom.id) return setSwapFrom(null);
      if (m.group === swapFrom.group) return; // same group: nothing to swap
      const a = swapFrom;
      setSwapFrom(null);
      await act({ action: "swap-members", a: a.id, b: m.id }, `${a.nickname} and ${m.nickname} swapped groups.`);
      return;
    }
    setPicked(m);
  };

  return (
    <div className="space-y-4">
      {swapFrom ? (
        <div className="sticky top-[136px] z-10 flex items-center justify-between gap-3 rounded-xl border border-[#a78bfa]/60 bg-[#2a1f4a] px-4 py-3 text-sm text-white sm:top-4">
          <span>
            Tap a player in another group to swap with <b>{swapFrom.nickname}</b>
          </span>
          <button type="button" className="shrink-0 underline" onClick={() => setSwapFrom(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-white">Add a player</p>
          <p className="text-xs text-mist">They need a Cue Point account first (register at cuepoint.lk/account).</p>
          <div className="flex flex-wrap gap-2">
            {view.groups.map((g) => (
              <button
                key={g.group}
                type="button"
                onClick={() => setAddTo(g.group)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  target === g.group ? "border-[#a78bfa]/70 bg-[#a78bfa]/15 text-white" : "border-white/15 text-mist",
                )}
              >
                into {g.name}
              </button>
            ))}
          </div>
          <PlayerPicker
            exclude={memberIds}
            disabled={busy}
            placeholder="Search by name…"
            onPick={(p) => act({ action: "add-member", playerId: p.id, group: target }, `${p.nickname} added to ${groupName(target)}.`)}
          />
        </Card>
      )}

      <p className="text-xs text-mist">Tap a player to move, swap or remove them. Changes count from the next week.</p>

      <div className={cn("grid gap-4", view.groupCount > 1 && "md:grid-cols-2")}>
        {view.groups.map((g) => (
          <div
            key={g.group}
            className={cn(
              "rounded-2xl border bg-white/[0.025] p-4",
              swapFrom && swapFrom.group !== g.group ? "border-[#a78bfa]/50" : "border-white/10",
            )}
          >
            <p className="flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold text-white">
                {g.group === 1 ? "★ " : ""}
                {g.name}
              </span>
              <span className="text-xs text-mist">{g.members.length} players</span>
            </p>
            <ul className="mt-2 divide-y divide-white/5">
              {g.members.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={busy || (!!swapFrom && swapFrom.group === g.group && swapFrom.id !== m.id)}
                    onClick={() => void tapMember(m)}
                    className={cn(
                      "flex min-h-[48px] w-full items-center gap-3 rounded-lg px-1 text-left active:bg-white/[0.06] disabled:opacity-40",
                      swapFrom?.id === m.id && "bg-[#a78bfa]/15",
                    )}
                  >
                    <PlayerAvatar name={m.nickname} src={m.avatar} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-white/90">{m.nickname}</span>
                    {moved.get(m.id) === "up" && <span className="text-xs font-semibold text-teal">▲ up</span>}
                    {moved.get(m.id) === "down" && <span className="text-xs font-semibold text-[#ffb066]">▼ down</span>}
                    <span aria-hidden className="text-mist">
                      {swapFrom ? "⇄" : "›"}
                    </span>
                  </button>
                </li>
              ))}
              {!g.members.length && <li className="py-3 text-sm text-mist">No players yet.</li>}
            </ul>
          </div>
        ))}
      </div>

      {picked && (
        <PlayerSheet
          m={picked}
          view={view}
          busy={busy}
          onClose={() => setPicked(null)}
          onSwap={() => {
            setSwapFrom(picked);
            setPicked(null);
          }}
          onMove={async (g) => {
            const m = picked;
            setPicked(null);
            await act({ action: "move-member", playerId: m.id, group: g }, `${m.nickname} moved to ${groupName(g)}.`);
          }}
          onRemove={async () => {
            const m = picked;
            if (!confirm(`Remove ${m.nickname} from the club?`)) return;
            setPicked(null);
            await act({ action: "remove-member", playerId: m.id }, `${m.nickname} removed from the club.`);
          }}
        />
      )}
    </div>
  );
}

/** bottom sheet (phone) / dialog (desktop) with everything for one player */
function PlayerSheet({
  m,
  view,
  busy,
  onClose,
  onSwap,
  onMove,
  onRemove,
}: {
  m: ClubMemberView;
  view: ClubView;
  busy: boolean;
  onClose: () => void;
  onSwap: () => void;
  onMove: (g: number) => void;
  onRemove: () => void;
}) {
  const others = view.groups.filter((g) => g.group !== m.group);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={m.nickname}
        className="w-full max-w-md space-y-3 rounded-t-3xl border border-white/10 bg-navy-900 p-5 pb-8 sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <PlayerAvatar name={m.nickname} src={m.avatar} size="md" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-white">{m.nickname}</p>
            <p className="text-xs text-mist">In {view.groups.find((g) => g.group === m.group)?.name}</p>
          </div>
        </div>
        {others.length > 0 && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onSwap}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[#a78bfa]/60 bg-[#a78bfa]/10 font-semibold text-white"
            >
              ⇄ Swap with a player in another group
            </button>
            {others.map((g) => (
              <button
                key={g.group}
                type="button"
                disabled={busy}
                onClick={() => onMove(g.group)}
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/15 text-white"
              >
                {g.group < m.group ? "▲" : "▼"} Move to {g.name}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl text-sm text-red-300"
        >
          Remove from club
        </button>
        <button type="button" onClick={onClose} className="flex min-h-[44px] w-full items-center justify-center text-sm text-mist">
          Close
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- settings ----------------------------- */

function Settings({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  const [count, setCount] = useState(view.groupCount);
  const [names, setNames] = useState<string[]>(view.groups.map((g) => g.name));
  const [moves, setMoves] = useState<string>(view.moveCount == null ? "half" : String(view.moveCount));
  const [s, setS] = useState<TournamentSettings>(view.leagueSettings);
  const frames = s.bestOf["Table matches"] ?? 1;

  const removing = view.groups.filter((g) => g.group > count && g.members.length).length;
  const nameFor = (i: number) => names[i] ?? (i === 0 ? "Pro" : `Group ${i + 1}`);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <p className="font-semibold text-white">Number of groups</p>
          <p className="text-xs text-mist">Group 1 is the top group. Add groups as the club grows.</p>
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              aria-label="Fewer groups"
              disabled={count <= 1}
              onClick={() => setCount(count - 1)}
              className="h-12 w-12 rounded-full border border-white/15 text-2xl text-white disabled:opacity-30"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-bold text-white">{count}</span>
            <button
              type="button"
              aria-label="More groups"
              disabled={count >= 12}
              onClick={() => setCount(count + 1)}
              className="h-12 w-12 rounded-full border border-white/15 text-2xl text-white disabled:opacity-30"
            >
              +
            </button>
          </div>
          {removing > 0 && (
            <p className="mt-2 text-xs text-[#ffc98f]">
              Players in the removed group{removing > 1 ? "s" : ""} go to the new bottom group.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-white">Group names</p>
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              className="input w-full"
              maxLength={30}
              aria-label={`Group ${i + 1} name`}
              value={nameFor(i)}
              onChange={(e) => {
                const next = [...names];
                while (next.length <= i) next.push(nameFor(next.length));
                next[i] = e.target.value;
                setNames(next);
              }}
            />
          ))}
        </div>
        <label className="block">
          <span className="font-semibold text-white">Players moving up / down each week</span>
          <span className="block text-xs text-mist">Between every two neighbouring groups.</span>
          <select className="input mt-2 w-full" value={moves} onChange={(e) => setMoves(e.target.value)}>
            <option value="half">Half the group (recommended)</option>
            {Array.from({ length: 10 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Nobody (keep groups)" : `${n} player${n === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="space-y-4">
        <p className="font-semibold text-white">League rules (every group)</p>
        <label className="block text-sm text-mist">
          Play each other
          <select
            className="input mt-1 w-full"
            value={s.legs}
            onChange={(e) => setS({ ...s, legs: Number(e.target.value) === 2 ? 2 : 1 })}
          >
            <option value={1}>Once</option>
            <option value={2}>Twice</option>
          </select>
        </label>
        <label className="block text-sm text-mist">
          Who wins the week
          <select
            className="input mt-1 w-full"
            value={s.finish}
            onChange={(e) => setS({ ...s, finish: e.target.value as LeagueFinish })}
          >
            {(Object.keys(FINISH_LABEL) as LeagueFinish[]).map((f) => (
              <option key={f} value={f}>
                {FINISH_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        {s.finish !== "table" && (
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-white/90">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={s.thirdPlace}
              onChange={(e) => setS({ ...s, thirdPlace: e.target.checked })}
            />
            Play a 3rd-place match
          </label>
        )}
        <label className="block text-sm text-mist">
          Frames per match
          <select
            className="input mt-1 w-full"
            value={frames}
            onChange={(e) => {
              const n = Number(e.target.value) as 1 | 3 | 5 | 7 | 9;
              const slots = bestOfSlots({ ...s, kind: "league" }, 16);
              setS({ ...s, bestOf: Object.fromEntries(slots.map((k) => [k, n])) as TournamentSettings["bestOf"] });
            }}
          >
            {[1, 3, 5, 7, 9].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Single frame" : `Best of ${n}`}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-mist">
          Frame scores count on the Cue Point rankings: a 3–0 win moves a rating more than 3–2. New rules apply from the
          next week.
        </p>
      </Card>

      <PrimaryButton
        className="w-full py-3.5 text-base sm:w-auto"
        disabled={busy}
        onClick={() =>
          act(
            {
              action: "settings",
              groupCount: count,
              groupNames: Array.from({ length: count }, (_, i) => nameFor(i)),
              moveCount: moves === "half" ? null : Number(moves),
              leagueSettings: s,
            },
            "Settings saved.",
          )
        }
      >
        Save settings
      </PrimaryButton>
    </div>
  );
}

/* ----------------------------- history ----------------------------- */

function History({ view, slug }: { view: ClubView; slug: string }) {
  if (!view.weeks.length) return <p className="text-sm text-mist">No weeks played yet.</p>;
  return (
    <div className="space-y-3">
      {view.weeks.map((w) => (
        <Card key={w.week}>
          <p className="font-semibold text-white">Week {w.week}</p>
          <div className="mt-2 space-y-2">
            {w.tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${slug}/tournaments/${t.id}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-white/10 px-3 text-sm text-white/90 active:bg-white/[0.06]"
              >
                <span>{t.groupName}</span>
                <span className="text-mist">
                  {t.status === "cancelled"
                    ? "cancelled"
                    : t.champion
                      ? `🏆 ${t.champion}`
                      : `${t.played}/${t.total} played`}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
