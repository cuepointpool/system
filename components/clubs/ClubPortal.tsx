"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { setActAsClub } from "@/components/friends/api";
import { Card, GhostButton, Notice, PrimaryButton } from "@/components/friends/ui";
import type { ClubMemberView, ClubView, CuePointPlayer } from "@/lib/clubs/store";
import { FormatPicker } from "@/components/friends/FormatPicker";
import { formatLine, type TournamentSettings } from "@/lib/friends/structure";
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
  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "week", label: "This week", icon: "🎱" },
    { id: "groups", label: `Players (${total})`, icon: "👥", badge: view.requests.length },
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
                "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[11px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:text-sm",
                tab === t.id
                  ? "border-[#a78bfa]/70 bg-[#a78bfa]/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-mist",
              )}
            >
              <span aria-hidden className="text-base">
                {t.icon}
              </span>
              {t.label}
              {!!t.badge && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec4899] px-1 text-[11px] font-bold text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}

      {tab === "week" && view.requests.length > 0 && (
        <button
          type="button"
          onClick={() => setTab("groups")}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-[#ec4899]/50 bg-[#ec4899]/10 px-4 text-left text-sm text-white"
        >
          <span>
            <b>{view.requests.length}</b> player{view.requests.length === 1 ? "" : "s"} asked to join
          </span>
          <span className="font-semibold text-[#f9a8d4]">Review →</span>
        </button>
      )}
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
  const playing = view.groups.length - short.length;
  const name = (g: number) => view.groups.find((x) => x.group === g)?.name ?? `Group ${g}`;
  const start = () => {
    if (
      short.length &&
      !confirm(
        `${short.map((g) => g.name).join(", ")} ${short.length === 1 ? "has" : "have"} fewer than 3 players and will sit this week out. Start week ${view.nextWeek} with the other ${playing === 1 ? "group" : `${playing} groups`}?`,
      )
    )
      return;
    void act(
      { action: "start-week", allowSkip: short.length > 0 },
      `Week ${view.nextWeek} started${short.length ? ` in ${playing} group${playing === 1 ? "" : "s"}` : ""} — the fixtures are out.`,
    );
  };

  const startButton = (
    <>
      {short.length > 0 && (
        <p className="rounded-xl border border-[#ffb066]/35 bg-[#ff9d3d]/[0.08] px-3 py-2 text-sm text-[#ffc98f]">
          {playing === 0 ? (
            <>No group has 3 players yet. </>
          ) : (
            <>
              {short.map((g) => g.name).join(", ")} {short.length === 1 ? "has" : "have"} fewer than 3 players — it
              {short.length === 1 ? "" : " they"} will sit this week out. Only full groups play.{" "}
            </>
          )}
          <button type="button" className="underline" onClick={goGroups}>
            Add players
          </button>
        </p>
      )}
      <PrimaryButton className="w-full py-3.5 text-base sm:w-auto" disabled={busy || playing === 0} onClick={start}>
        ▶ Start week {view.nextWeek}
        {short.length > 0 && playing > 0 ? ` (${playing} group${playing === 1 ? "" : "s"})` : ""}
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
                  {t.group === 0 ? "🏆 " : t.group === 1 ? "★ " : ""}
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
        {view.finalSettings.enabled && !current.tournaments.some((t) => t.group === 0) && (
          <p className="rounded-2xl border border-dashed border-[#a78bfa]/40 px-4 py-3 text-sm text-[#c4b5fd]">
            🏆 Club final — the top {view.finalSettings.perGroup} of each group play it as soon as every group has
            finished.
          </p>
        )}
        {view.groups
          .filter((g) => !current.tournaments.some((t) => t.group === g.group))
          .map((g) => (
            <p key={g.group} className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-mist">
              {g.name} · sitting out this week ({g.members.length} player{g.members.length === 1 ? "" : "s"})
            </p>
          ))}
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

        <HowItsPlayed view={view} busy={busy} act={act} />
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
    <div className="space-y-4">
    <HowItsPlayed view={view} busy={busy} act={act} />
    <Card className="space-y-3">
      <h2 className="font-display text-xl font-bold text-white">Week 1</h2>
      <p className="text-sm text-mist">
        Starts a tournament in every group. Everyone is put in straight away — nobody has to accept.
      </p>
      <GroupCounts view={view} />
      {startButton}
    </Card>
    </div>
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
          {g.members.length < 3 ? " · sits out" : ""}
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
  const [mode, setMode] = useState<"groups" | "add">(view.groups.every((g) => !g.members.length) ? "add" : "groups");
  const [picked, setPicked] = useState<ClubMemberView | null>(null);
  const [swapFrom, setSwapFrom] = useState<ClubMemberView | null>(null);
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
        <>
        {view.requests.length > 0 && <JoinRequests view={view} busy={busy} act={act} />}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              ["groups", `Club groups (${memberIds.size})`],
              ["add", "＋ Add players"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "min-h-[48px] rounded-xl text-sm font-semibold",
                mode === id ? "bg-[#a78bfa]/20 text-white" : "text-mist",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        </>
      )}

      {mode === "add" && !swapFrom && <PlayerDirectory view={view} busy={busy} act={act} />}

      {mode === "groups" && (
      <>
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

      </>
      )}

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

/** players who asked to join from the club page */
function JoinRequests({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  return (
    <div className="rounded-2xl border border-[#ec4899]/40 bg-[#ec4899]/[0.06] p-4">
      <p className="font-display text-lg font-bold text-white">Asked to join ({view.requests.length})</p>
      <p className="text-xs text-mist">Tap a group to accept them into it.</p>
      <ul className="mt-2 divide-y divide-white/5">
        {view.requests.map((r) => (
          <li key={r.playerId} className="py-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar name={r.nickname} src={r.avatar} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-white">{r.nickname}</span>
                <span className="block truncate text-xs text-mist">
                  {r.fullName !== r.nickname ? `${r.fullName} · ` : ""}@{r.slug}
                </span>
              </span>
            </div>
            {r.message && <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white/90">“{r.message}”</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {view.groups.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "add-member", playerId: r.playerId, group: g.group }, `${r.nickname} accepted into ${g.name}.`)}
                  className="min-h-[44px] rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-4 text-sm font-bold text-white disabled:opacity-40"
                >
                  ✓ {g.name}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Decline ${r.nickname}'s request?`))
                    void act({ action: "decline-request", playerId: r.playerId }, `${r.nickname}'s request declined.`);
                }}
                className="min-h-[44px] rounded-full border border-white/15 px-4 text-sm text-mist"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** every registered Cue Point player, with one-tap "add to group" buttons */
function PlayerDirectory({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  const [players, setPlayers] = useState<CuePointPlayer[] | null>(null);
  const [q, setQ] = useState("");
  const [onlyNew, setOnlyNew] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/club/players", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load players.");
        setPlayers(d.players ?? []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  // reload whenever the club changes (someone added / moved / removed)
  useEffect(() => load(), [load, view]);

  const groupName = (g: number) => view.groups.find((x) => x.group === g)?.name ?? `Group ${g}`;
  const term = q.trim().toLowerCase();
  const all = players ?? [];
  const list = all.filter(
    (p) =>
      (!onlyNew || p.group == null) &&
      (!term || p.nickname.toLowerCase().includes(term) || p.fullName.toLowerCase().includes(term) || p.slug.includes(term)),
  );
  const notIn = all.filter((p) => p.group == null).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-mist">
        All registered Cue Point players ({all.length}) · {notIn} not in the club yet. New players register at
        cuepoint.lk/account, then appear here.
      </p>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name…"
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none"
      />
      <label className="flex min-h-[40px] items-center gap-3 text-sm text-white/90">
        <input type="checkbox" className="h-5 w-5" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
        Only players not in the club
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      {players === null && !error && <p className="text-sm text-mist">Loading players…</p>}
      {players && !list.length && (
        <p className="text-sm text-mist">{term ? "Nobody matches that name." : "Everyone is already in the club."}</p>
      )}
      <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.025]">
        {list.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <PlayerAvatar name={p.nickname} src={p.avatar} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-white">{p.nickname}</span>
              <span className="block truncate text-xs text-mist">
                {p.fullName !== p.nickname ? `${p.fullName} · ` : ""}@{p.slug}
              </span>
            </span>
            {p.group != null ? (
              <span className="rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-xs text-teal">
                In {groupName(p.group)}
              </span>
            ) : (
              <span className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                {view.groups.map((g) => (
                  <button
                    key={g.group}
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: "add-member", playerId: p.id, group: g.group }, `${p.nickname} added to ${g.name}.`)}
                    className="min-h-[40px] rounded-full border border-[#a78bfa]/60 px-4 text-sm font-semibold text-[#c4b5fd] active:bg-[#a78bfa]/15 disabled:opacity-40"
                  >
                    + {g.name}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
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
            },
            "Settings saved.",
          )
        }
      >
        Save group settings
      </PrimaryButton>

      <HowItsPlayed view={view} busy={busy} act={act} />
    </div>
  );
}

/* ----------------------------- how it's played ----------------------------- */

/**
 * The same choices as creating any Cue Point tournament — for every group,
 * and for the optional club final (top players of every group).
 */
function HowItsPlayed({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  const [groupS, setGroupS] = useState<TournamentSettings>(view.leagueSettings);
  const [fin, setFin] = useState(view.finalSettings);
  const [edit, setEdit] = useState<"groups" | "final" | null>(null);
  const playing = Math.max(1, view.groups.filter((g) => g.members.length >= 3).length);
  const groupSize = Math.max(3, ...view.groups.map((g) => g.members.length));
  const finalSize = Math.max(3, fin.perGroup * playing);
  const dirty =
    JSON.stringify(groupS) !== JSON.stringify(view.leagueSettings) ||
    JSON.stringify(fin) !== JSON.stringify(view.finalSettings);
  const multi = view.groupCount > 1;

  return (
    <Card className="space-y-4">
      <div>
        <p className="font-display text-lg font-bold text-white">How it&apos;s played</p>
        <p className="text-xs text-mist">The same options as any Cue Point tournament. Changes apply to the next week.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">{multi ? "Each group plays" : "The club plays"}</p>
        <p className="mt-1 text-sm text-[#c4b5fd]">{formatLine(groupS)}</p>
        {edit === "groups" ? (
          <div className="mt-3">
            <FormatPicker value={groupS} onChange={setGroupS} entries={groupSize} noun="player" noLimit />
            <GhostButton className="mt-3" onClick={() => setEdit(null)}>
              Done
            </GhostButton>
          </div>
        ) : (
          <GhostButton className="mt-3" onClick={() => setEdit("groups")}>
            Change
          </GhostButton>
        )}
      </div>

      {multi && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-white">🏆 Club final</span>
              <span className="block text-xs text-mist">
                After the groups, the top players of every group play together until one wins. Then the groups are
                re-made.
              </span>
            </span>
            <input
              type="checkbox"
              className="h-6 w-6 shrink-0"
              checked={fin.enabled}
              onChange={(e) => setFin({ ...fin, enabled: e.target.checked })}
            />
          </label>
          {fin.enabled && (
            <>
              <p className="mt-3 text-sm text-white/90">From each group, the top</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFin({ ...fin, perGroup: n })}
                    className={cn(
                      "min-h-[48px] rounded-xl border text-lg font-bold",
                      fin.perGroup === n ? "border-[#a78bfa]/70 bg-[#a78bfa]/20 text-white" : "border-white/15 text-mist",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-mist">
                About {fin.perGroup * playing} players · group winners are kept apart.
              </p>
              <p className="mt-3 text-sm text-[#c4b5fd]">{formatLine(fin.settings)}</p>
              {edit === "final" ? (
                <div className="mt-3">
                  <FormatPicker
                    value={fin.settings}
                    onChange={(x) => setFin({ ...fin, settings: x })}
                    entries={finalSize}
                    noun="player"
                    noLimit
                  />
                  <GhostButton className="mt-3" onClick={() => setEdit(null)}>
                    Done
                  </GhostButton>
                </div>
              ) : (
                <GhostButton className="mt-3" onClick={() => setEdit("final")}>
                  Change final format
                </GhostButton>
              )}
            </>
          )}
        </div>
      )}

      <PrimaryButton
        className="w-full py-3.5 text-base sm:w-auto"
        disabled={busy || !dirty}
        onClick={async () => {
          if (await act({ action: "settings", leagueSettings: groupS, finalSettings: fin }, "Saved — used from the next week."))
            setEdit(null);
        }}
      >
        {dirty ? "Save how it's played" : "Saved ✓"}
      </PrimaryButton>
    </Card>
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
