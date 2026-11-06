"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { PlayerPicker } from "@/components/friends/PlayerPicker";
import { setActAsClub } from "@/components/friends/api";
import { Card, GhostButton, Notice, PrimaryButton, StatusPill } from "@/components/friends/ui";
import type { ClubView } from "@/lib/clubs/store";
import {
  bestOfSlots,
  FINISH_LABEL,
  formatLine,
  type LeagueFinish,
  type TournamentSettings,
} from "@/lib/friends/structure";
import type { TournamentStatus } from "@/lib/friends/types";
import { cn } from "@/lib/utils";

type Me = { name: string; slug: string; username: string | null; hostId: string };

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

  // the player search below runs as the club
  useEffect(() => {
    setActAsClub(!!me);
    return () => setActAsClub(false);
  }, [me]);

  if (me === undefined) return <Shell><p className="text-sm text-mist">Loading…</p></Shell>;
  if (!me || !view) return <Shell><Login onDone={load} /></Shell>;

  return (
    <Shell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-teal">Club admin · on Cue Point</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">{me.name}</h1>
          <p className="mt-1.5 text-sm text-mist">
            Signed in as <span className="text-white/90">{me.username}</span> ·{" "}
            <Link href={`/clubs/${me.slug}`} className="underline">
              Public club page
            </Link>
          </p>
        </div>
        <GhostButton
          onClick={async () => {
            await fetch("/api/club/logout", { method: "POST" }).catch(() => {});
            setMe(null);
            setView(null);
          }}
        >
          Sign out
        </GhostButton>
      </div>
      <Manage view={view} slug={me.slug} onView={setView} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl space-y-6 px-5 pb-28 pt-28 md:px-8">{children}</div>;
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
        <PrimaryButton className="w-full" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Manage({ view, slug, onView }: { view: ClubView; slug: string; onView: (v: ClubView) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(body: Record<string, unknown>, ok?: string) {
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
  }

  const total = view.groups.reduce((n, g) => n + g.members.length, 0);
  const memberIds = new Set(view.groups.flatMap((g) => g.members.map((m) => m.id)));

  return (
    <div className="space-y-6">
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      <ThisWeek view={view} slug={slug} busy={busy} act={act} />
      <Groups view={view} busy={busy} act={act} total={total} memberIds={memberIds} />
      <Settings view={view} busy={busy} act={act} />
      <History view={view} slug={slug} />
    </div>
  );
}

type Act = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

function ThisWeek({ view, slug, busy, act }: { view: ClubView; slug: string; busy: boolean; act: Act }) {
  const current = view.weeks[0];
  if (view.running && current) {
    return (
      <Card>
        <h2 className="font-display text-xl font-bold text-white">Week {current.week} is on</h2>
        <p className="mt-1 text-sm text-mist">
          Open a group&apos;s league to start matches and enter results. When every group has finished, the group moves
          for next week appear here.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {current.tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/clubs/${slug}/tournaments/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-[#a78bfa]/50"
            >
              <span>
                <span className="block font-semibold text-white">{t.groupName}</span>
                <span className="text-xs text-mist">{t.players} players</span>
              </span>
              <StatusPill status={t.status as TournamentStatus} kind="tournament" />
            </Link>
          ))}
        </div>
      </Card>
    );
  }

  if (view.movesPending && current) {
    const up = view.proposedMoves.filter((m) => m.to < m.from);
    const down = view.proposedMoves.filter((m) => m.to > m.from);
    const name = (g: number) => view.groups.find((x) => x.group === g)?.name ?? `Group ${g}`;
    return (
      <Card>
        <h2 className="font-display text-xl font-bold text-white">Week {current.week} is finished — new groups</h2>
        <p className="mt-1 text-sm text-mist">
          {view.proposedMoves.length
            ? "From the final standings: the bottom players of each group go down and the top players of the group below go up."
            : "Nobody moves this time."}{" "}
          You can still move anyone by hand afterwards.
        </p>
        {view.proposedMoves.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MoveList title="Going up ▲" tone="text-teal" moves={up} name={name} />
            <MoveList title="Going down ▼" tone="text-[#ffb066]" moves={down} name={name} />
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryButton disabled={busy} onClick={() => act({ action: "apply-moves" }, "Groups updated for next week.")}>
            Apply these moves
          </PrimaryButton>
          <GhostButton disabled={busy} onClick={() => act({ action: "keep-groups" }, "Groups kept as they are.")}>
            Keep groups as they are
          </GhostButton>
        </div>
      </Card>
    );
  }

  const short = view.groups.filter((g) => g.members.length < 3);
  return (
    <Card>
      <h2 className="font-display text-xl font-bold text-white">Week {view.nextWeek}</h2>
      <p className="mt-1 text-sm text-mist">
        Starts a league in every group with the players below ({formatLine(view.leagueSettings)}). Everyone is put in
        straight away — nobody has to accept.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        {view.groups.map((g) => (
          <li
            key={g.group}
            className={cn(
              "rounded-full border px-3 py-1",
              g.members.length < 3 ? "border-red-400/40 text-red-300" : "border-white/15 text-white/90",
            )}
          >
            {g.name}: {g.members.length} players
          </li>
        ))}
      </ul>
      {short.length > 0 && (
        <p className="mt-3 text-xs text-red-300">Every group needs at least 3 players before the week can start.</p>
      )}
      <PrimaryButton
        className="mt-4"
        disabled={busy || short.length > 0}
        onClick={() => act({ action: "start-week" }, `Week ${view.nextWeek} started — the fixtures are out.`)}
      >
        Start week {view.nextWeek}
      </PrimaryButton>
    </Card>
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
  moves: ClubView["proposedMoves"];
  name: (g: number) => string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className={cn("text-sm font-semibold", tone)}>{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-white/90">
        {moves.map((m) => (
          <li key={m.playerId}>
            {m.nickname} <span className="text-mist">— {name(m.from)} → {name(m.to)}</span>
          </li>
        ))}
        {!moves.length && <li className="text-mist">Nobody</li>}
      </ul>
    </div>
  );
}

function Groups({
  view,
  busy,
  act,
  total,
  memberIds,
}: {
  view: ClubView;
  busy: boolean;
  act: Act;
  total: number;
  memberIds: Set<string>;
}) {
  const [addTo, setAddTo] = useState(view.groupCount);
  const target = Math.min(addTo, view.groupCount);
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Players &amp; groups</h2>
          <p className="mt-1 text-sm text-mist">
            {total} member{total === 1 ? "" : "s"}. Players register a normal Cue Point account first, then you add them
            here. Changes count from the next week.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <PlayerPicker
          exclude={memberIds}
          disabled={busy}
          placeholder="Add a player — search Cue Point players by name…"
          onPick={(p) => act({ action: "add-member", playerId: p.id, group: target }, `${p.nickname} added.`)}
        />
        <label className="flex items-center gap-2 text-sm text-mist">
          into
          <select className="input" value={target} onChange={(e) => setAddTo(Number(e.target.value))}>
            {view.groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={cn("mt-5 grid gap-4", view.groupCount > 1 && "md:grid-cols-2", view.groupCount > 2 && "lg:grid-cols-3")}>
        {view.groups.map((g) => (
          <div key={g.group} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-baseline justify-between">
              <span className="font-semibold text-white">
                {g.group === 1 ? "★ " : ""}
                {g.name}
              </span>
              <span className="text-xs text-mist">{g.members.length} players</span>
            </p>
            <ul className="mt-3 space-y-2">
              {g.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <PlayerAvatar name={m.nickname} src={m.avatar} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm text-white/90">{m.nickname}</span>
                  <select
                    aria-label={`Move ${m.nickname}`}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white"
                    value={m.group}
                    disabled={busy}
                    onChange={(e) =>
                      act({ action: "move-member", playerId: m.id, group: Number(e.target.value) }, `${m.nickname} moved.`)
                    }
                  >
                    {view.groups.map((x) => (
                      <option key={x.group} value={x.group}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    title="Remove from club"
                    className="px-1 text-xs text-mist hover:text-red-300"
                    onClick={() => {
                      if (confirm(`Remove ${m.nickname} from the club?`))
                        void act({ action: "remove-member", playerId: m.id }, `${m.nickname} removed.`);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
              {!g.members.length && <li className="text-sm text-mist">No players yet.</li>}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Settings({ view, busy, act }: { view: ClubView; busy: boolean; act: Act }) {
  const [count, setCount] = useState(view.groupCount);
  const [names, setNames] = useState<string[]>(view.groups.map((g) => g.name));
  const [moves, setMoves] = useState<string>(view.moveCount == null ? "half" : String(view.moveCount));
  const [s, setS] = useState<TournamentSettings>(view.leagueSettings);
  const frames = s.bestOf["Table matches"] ?? 1;

  const removing = view.groups.filter((g) => g.group > count && g.members.length).length;
  const nameFor = (i: number) => names[i] ?? (i === 0 ? "Pro" : `Group ${i + 1}`);

  return (
    <Card>
      <h2 className="font-display text-xl font-bold text-white">Settings</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">How many groups?</p>
            <p className="text-xs text-mist">Group 1 is the top group. Add more groups as the club grows.</p>
            <div className="mt-2 flex items-center gap-3">
              <GhostButton type="button" disabled={count <= 1} onClick={() => setCount(count - 1)}>
                −
              </GhostButton>
              <span className="w-8 text-center text-lg font-bold text-white">{count}</span>
              <GhostButton type="button" disabled={count >= 12} onClick={() => setCount(count + 1)}>
                +
              </GhostButton>
            </div>
            {removing > 0 && (
              <p className="mt-2 text-xs text-[#ffc98f]">
                Players in the removed group{removing > 1 ? "s" : ""} will go to the new bottom group.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Group names</p>
            {Array.from({ length: count }, (_, i) => (
              <input
                key={i}
                className="input w-full"
                maxLength={30}
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
          <div>
            <p className="text-sm font-semibold text-white">Players moving up / down each week</p>
            <p className="text-xs text-mist">Between every two neighbouring groups.</p>
            <select className="input mt-2" value={moves} onChange={(e) => setMoves(e.target.value)}>
              <option value="half">Half of the smaller group (recommended)</option>
              {Array.from({ length: 10 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Nobody (keep groups)" : `${n} player${n === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-white">League rules (every group)</p>
          <label className="block text-sm text-mist">
            Play each other
            <select
              className="input mt-1 w-full"
              value={s.legs}
              onChange={(e) => setS({ ...s, legs: Number(e.target.value) === 2 ? 2 : 1 })}
            >
              <option value={1}>Once</option>
              <option value={2}>Twice (home and away)</option>
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
            <label className="flex items-center gap-2 text-sm text-mist">
              <input type="checkbox" checked={s.thirdPlace} onChange={(e) => setS({ ...s, thirdPlace: e.target.checked })} />
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
            Ties on points are played off (same rules as every Cue Point tournament). New rules apply from the next week.
          </p>
        </div>
      </div>
      <PrimaryButton
        className="mt-6"
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
    </Card>
  );
}

function History({ view, slug }: { view: ClubView; slug: string }) {
  const past = view.running ? view.weeks.slice(1) : view.weeks;
  if (!past.length) return null;
  return (
    <Card>
      <h2 className="font-display text-xl font-bold text-white">Past weeks</h2>
      <ul className="mt-3 space-y-3">
        {past.map((w) => (
          <li key={w.week}>
            <p className="text-sm font-semibold text-white">Week {w.week}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {w.tournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/clubs/${slug}/tournaments/${t.id}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/90 hover:border-[#a78bfa]/50"
                >
                  {t.groupName}
                  {t.status === "cancelled" ? " · cancelled" : t.champion ? ` · 🏆 ${t.champion}` : ""}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
