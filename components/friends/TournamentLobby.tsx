"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDayTime, formatLKR } from "@/lib/utils";
import { MIN_TEAMS_TO_START } from "@/lib/friends/formats";
import { bestOfLabel, describe, framesToWin, winningScores, type TournamentSettings } from "@/lib/friends/structure";
import type { GameView, PendingTie, TeamView, TournamentSection, TournamentView } from "@/lib/friends/types";
import { apiPost } from "./api";
import { FormatPicker, formatLine } from "./FormatPicker";
import { LiveDot } from "./GameLobby";
import { GuestAdder, PlayerPicker, type PickedPlayer } from "./PlayerPicker";
import { useLiveView } from "./useLiveView";
import { Card, CountBar, GhostButton, Notice, PlayerLine, PrimaryButton } from "./ui";

/* ------------------------------------------------------------------
   The tournament page, built for people who just want to play:
     · one box at the top that says what to do now
     · four big tabs: Play now · Standings · All matches · Players
     · every match card has one clear button; entering a result is
       "who won?" then (for longer matches) "what was the score?"
   ------------------------------------------------------------------ */

interface ConfirmInfo {
  complete: number;
  capacity: number;
  dropped: string[];
  byes: number;
}

type Tab = "play" | "standings" | "matches" | "players" | "format";

/** the venue's tables, so a match can be started "on Table 2" */
const TablesContext = createContext<string[]>([]);

export function TournamentLobby({ initial, meId }: { initial: TournamentView; meId: string }) {
  const router = useRouter();
  const { data: t, refetch, gone } = useLiveView(
    initial,
    `/api/friends/tournaments/${initial.id}`,
    "tournament",
    [`tournament:${initial.id}`, "user"],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmInfo | null>(null);
  const [draft, setDraft] = useState<PickedPlayer[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [cancel, setCancel] = useState<{ code: string; typed: string } | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tables) && setTables(d.tables.map((x: { label: string }) => x.label.split(" — ")[0])))
      .catch(() => {});
  }, []);

  // being on this page means you've seen its news — clear those from the bell
  useEffect(() => {
    if (meId) void apiPost("/api/friends/notifications", { href: `/play/tournaments/${t.id}` });
  }, [t.id, t.version, meId]);

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const r = await apiPost(`/api/friends/tournaments/${t.id}/${action}`, body);
    if (!r.ok) {
      if (r.status === 409 && r.details && (r.details as { code?: string }).code === "confirm") {
        setConfirm(r.details as unknown as ConfirmInfo);
      } else setError(r.error);
    } else setConfirm(null);
    await refetch();
    setBusy(false);
    return r.ok;
  }

  const home = t.official ? "/tournaments" : "/play";
  if (gone) {
    return (
      <Notice tone="warn">
        This tournament is no longer available to you.{" "}
        <Link href={home} className="underline">Go back</Link>
      </Notice>
    );
  }

  const v = t.viewer;
  const ppt = t.playersPerTeam;
  const noun = ppt === 1 ? "players" : "teams";
  const open = t.status === "registration_open";
  const taken = new Set(t.teams.flatMap((x) => x.members.map((m) => m.id)));

  const everyGame = t.sections.flatMap(sectionGames);
  const playingNow = everyGame.filter((g) => !g.isBye && g.status === "in_progress");
  const atTable = new Set(playingNow.flatMap((g) => [g.teamA?.id, g.teamB?.id]).filter(Boolean));
  const readyAll = everyGame.filter((g) => !g.isBye && g.status === "ready");
  const readyNow = readyAll.filter((g) => !atTable.has(g.teamA?.id) && !atTable.has(g.teamB?.id));
  const waiting = readyAll.length - readyNow.length;

  const tabs: { id: Tab; label: string; icon: string }[] = open
    ? [
        { id: "players", label: ppt === 1 ? "Players" : "Teams", icon: "👥" },
        { id: "format", label: "How it's played", icon: "📖" },
      ]
    : [
        { id: "play", label: "Play now", icon: "▶" },
        { id: "standings", label: t.kind === "knockout" || t.kind === "double_elim" ? "Bracket" : "Standings", icon: "🏆" },
        { id: "matches", label: "All matches", icon: "📋" },
        { id: "players", label: ppt === 1 ? "Players" : "Teams", icon: "👥" },
      ];
  const activeTab: Tab = tab && tabs.some((x) => x.id === tab) ? tab : tabs[0].id;

  async function addToDraft(p: PickedPlayer) {
    const guestNames = new Set(
      t.teams.flatMap((x) => x.members.filter((m) => m.guest).map((m) => m.nickname.toLowerCase())),
    );
    if (p.guest && guestNames.has(p.nickname.toLowerCase())) {
      setError(`There is already a guest called ${p.nickname}. Use a different name.`);
      return;
    }
    if (taken.has(p.id) || draft.some((d) => d.id === p.id)) {
      setError(ppt === 1 ? `${p.nickname} is already in.` : `${p.nickname} is already in a team.`);
      return;
    }
    const next = [...draft, p];
    if (next.length === ppt) {
      setDraft([]);
      await act("add-team", {
        playerIds: next.filter((x) => !x.guest).map((x) => x.id),
        guests: next.filter((x) => x.guest).map((x) => x.nickname),
      });
    } else {
      setError(null);
      setDraft(next);
    }
  }

  return (
    <TablesContext.Provider value={tables}>
      <div className="space-y-5">
        {/* ---------- header ---------- */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c4b5fd]">
                {t.official ? "Cue Point tournament · " : ""}
                {statusWords(t)}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">{t.name}</h1>
              <p className="mt-1 text-sm text-mist">
                {ppt === 1 ? "Singles" : "Doubles"} · {formatLine(t.settings)}
              </p>
              {t.official ? (
                t.official.summary && <p className="mt-2 max-w-2xl text-sm text-white/90">{t.official.summary}</p>
              ) : (
                <p className="mt-1 text-xs text-mist">
                  Organized by {t.organizer.nickname}
                  {v.isOrganizer ? " (you)" : ""}
                </p>
              )}
            </div>
            <LiveDot />
          </div>
          {t.official && <OfficialFacts t={t} />}
          {t.guests > 0 && (
            <p className="mt-3 text-xs text-mist">
              Matches with a guest (no Cue Point account) are just for fun — they earn no points.
            </p>
          )}
        </Card>

        {/* ---------- what to do now ---------- */}
        <NextStep
          t={t}
          meId={meId}
          busy={busy}
          readyNow={readyNow.length}
          onAct={act}
          onDone={refetch}
          onGo={setTab}
          onLeave={async () => (await act("respond", { accept: false })) && router.push(home)}
        />

        {confirm && (
          <Card className="border-[#ffb066]/40 bg-[#ff9d3d]/[0.06]">
            <p className="text-base font-semibold text-white">Start with who&apos;s ready now?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist">
              <li>
                {confirm.complete} of {confirm.capacity} {noun} are ready.
              </li>
              {confirm.byes > 0 && (
                <li>
                  {confirm.byes} {noun} get a free pass through the first round.
                </li>
              )}
              {confirm.dropped.length > 0 && <li>Left out (not complete): {confirm.dropped.join(", ")}.</li>}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton className="px-6 py-3 text-base" disabled={busy} onClick={() => act("start", { force: true })}>
                Yes, start now
              </PrimaryButton>
              <GhostButton onClick={() => setConfirm(null)}>Wait for more</GhostButton>
            </div>
          </Card>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        {/* ---------- tabs ---------- */}
        <div role="tablist" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={activeTab === x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3 text-center transition-colors sm:flex-row sm:justify-center sm:gap-2",
                activeTab === x.id
                  ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white"
                  : "border-white/10 text-mist hover:border-white/30 hover:text-white",
              )}
            >
              <span aria-hidden className="text-lg leading-none">{x.icon}</span>
              <span className="text-xs font-semibold sm:text-sm">{x.label}</span>
            </button>
          ))}
        </div>

        <div>
          {activeTab === "play" && (
            <div className="space-y-6">
              {t.pendingTies.map((tie, i) => (
                <TieCard key={i} tie={tie} ppt={ppt} />
              ))}
              <Block title="On the tables now" empty="Nobody is playing right now." games={playingNow} meId={meId} ppt={ppt} onDone={refetch} />
              <Block
                title="Ready to start"
                hint="Start as many as you have free tables."
                empty={t.status === "in_progress" ? "No match can start right now." : ""}
                games={readyNow}
                meId={meId}
                ppt={ppt}
                onDone={refetch}
              />
              {waiting > 0 && (
                <p className="text-sm text-mist">
                  {waiting} more match{waiting === 1 ? " is" : "es are"} waiting for a player who&apos;s still at a table.
                </p>
              )}
            </div>
          )}

          {activeTab === "standings" && <StandingsTab t={t} meId={meId} onDone={refetch} />}

          {activeTab === "matches" && <AllMatches t={t} meId={meId} onDone={refetch} />}

          {activeTab === "players" && (
            <PlayersTab
              t={t}
              meId={meId}
              busy={busy}
              draft={draft}
              taken={taken}
              onAct={act}
              onAdd={addToDraft}
              onClearDraft={() => setDraft([])}
              onError={setError}
            />
          )}

          {activeTab === "format" && <FormatCard t={t} busy={busy} onSave={(settings) => act("format", { settings })} />}
        </div>

        {/* ---------- cancel (needs a typed code) ---------- */}
        {cancel && (
          <Card className="border-red-400/40 bg-red-400/[0.06]">
            <p className="text-base font-semibold text-white">Cancel {t.name} for everyone?</p>
            <p className="mt-1 text-sm text-mist">This can&apos;t be undone. To confirm, type this code:</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-[0.3em] text-white tabular-nums">{cancel.code}</p>
            <input
              value={cancel.typed}
              onChange={(e) => setCancel({ ...cancel, typed: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Type the code"
              aria-label="Type the code to confirm"
              className="mt-3 w-48 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-center font-display text-xl tracking-[0.25em] text-white focus:border-red-400/60 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton className="px-6 py-3 text-base" onClick={() => setCancel(null)}>
                Keep playing
              </PrimaryButton>
              <GhostButton
                danger
                disabled={busy || cancel.typed !== cancel.code}
                onClick={async () => {
                  if (await act("cancel", { code: cancel.typed })) setCancel(null);
                }}
              >
                Yes, cancel it
              </GhostButton>
            </div>
            <p className="mt-2 text-xs text-mist">The code works for 10 minutes.</p>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
          <Link href={home} className="text-sm text-mist hover:text-white">
            {t.official ? "← All tournaments" : "← Back to Play"}
          </Link>
          {open && v.canLeave && !v.isOrganizer && !v.invited && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (t.official) await act("respond", { accept: false });
                else if (await act("respond", { accept: false })) router.push(home);
              }}
              className="text-sm text-mist hover:text-red-300"
            >
              {t.official ? "Withdraw my entry" : "Leave this tournament"}
            </button>
          )}
          {v.canCancel && !cancel && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setError(null);
                const r = await apiPost<{ code: string }>(`/api/friends/tournaments/${t.id}/cancel-code`, {});
                if (r.ok) setCancel({ code: r.data.code, typed: "" });
                else setError(r.error);
              }}
              className="ml-auto text-sm text-mist hover:text-red-300"
            >
              Cancel tournament
            </button>
          )}
        </div>
      </div>
    </TablesContext.Provider>
  );
}

/* the event details of a tournament Cue Point hosts */
function OfficialFacts({ t }: { t: TournamentView }) {
  const o = t.official!;
  const [rules, setRules] = useState(false);
  const facts: [string, string][] = [
    ["Starts", o.startAt ? formatDayTime(o.startAt) : "Date will be announced"],
    ["Entry", o.entryFee ? formatLKR(o.entryFee) : "Free"],
    ["Players", `${t.teams.length} / ${t.capacityTeams}`],
  ];
  if (o.prizePool) facts.splice(1, 0, ["Prize pool", formatLKR(o.prizePool)]);
  if (o.registrationDeadline && t.status === "registration_open")
    facts.push(["Sign up by", formatDayTime(o.registrationDeadline)]);
  return (
    <div className="mt-4 flex flex-col gap-5 border-t border-white/10 pt-4 sm:flex-row-reverse sm:items-start">
      {o.poster && (
        <a href={o.poster} target="_blank" rel="noreferrer" className="block shrink-0 sm:w-56" title="Open the poster">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.poster} alt={`${t.name} poster`} className="w-full rounded-xl ring-1 ring-white/15" />
        </a>
      )}
      <div className="min-w-0 flex-1">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {facts.map(([k, val]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-wider text-mist/60">{k}</dt>
            <dd className={cn("mt-0.5 text-sm font-semibold", k === "Prize pool" ? "text-gold" : "text-white")}>{val}</dd>
          </div>
        ))}
      </dl>
      {o.rules.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setRules((x) => !x)} className="text-sm text-[#c4b5fd] underline">
            {rules ? "Hide the rules" : "Read the rules"}
          </button>
          {rules && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist">
              {o.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

/* ============================ top box ============================ */

function statusWords(t: TournamentView): string {
  if (t.status === "registration_open") return "Getting ready";
  if (t.status === "in_progress") return t.phase === "tiebreak" ? "Playing · tie-breakers" : "Playing";
  if (t.status === "completed") return "Finished";
  return "Cancelled";
}

/** one box that tells this person what to do next */
function NextStep({
  t,
  meId,
  busy,
  readyNow,
  onAct,
  onDone,
  onGo,
  onLeave,
}: {
  t: TournamentView;
  meId: string;
  busy: boolean;
  readyNow: number;
  onAct: (action: string, body?: Record<string, unknown>) => Promise<boolean>;
  onDone: () => Promise<void>;
  onGo: (tab: Tab) => void;
  onLeave: () => void;
}) {
  const v = t.viewer;
  const noun = t.playersPerTeam === 1 ? "players" : "teams";
  const box = (children: React.ReactNode, tone: "accent" | "ok" | "plain" = "accent") => (
    <section
      className={cn(
        "rounded-2xl border-2 p-5",
        tone === "accent" && "border-[#a78bfa]/50 bg-[linear-gradient(160deg,rgba(167,139,250,0.14),rgba(236,72,153,0.04))]",
        tone === "ok" && "border-teal/40 bg-teal/[0.07]",
        tone === "plain" && "border-white/10 bg-white/[0.02]",
      )}
    >
      {children}
    </section>
  );
  const heading = (text: string) => <p className="font-display text-xl font-bold text-white">{text}</p>;

  if (t.status === "cancelled") return box(heading("This tournament was cancelled."), "plain");

  if (t.status === "completed") {
    return box(
      <>
        <p className="text-4xl" aria-hidden>🏆</p>
        {t.groupWinners.length ? (
          <>
            {heading("Group winners")}
            <ul className="mt-2 space-y-1 text-base text-white">
              {t.groupWinners.map((w) => (
                <li key={w.group}>
                  {w.title}: <strong>{teamLabel(w.team, t.playersPerTeam)}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : t.champion ? (
          <>
            {heading(`${teamLabel(t.champion, t.playersPerTeam)} won!`)}
            <p className="mt-1 text-sm text-mist">
              {t.runnerUp ? `Runner-up: ${teamLabel(t.runnerUp, t.playersPerTeam)}` : ""}
              {t.third ? ` · 3rd: ${teamLabel(t.third, t.playersPerTeam)}` : ""}
            </p>
          </>
        ) : (
          heading("Finished")
        )}
      </>,
      "ok",
    );
  }

  if (t.status === "registration_open" && t.official && !v.canStart) {
    const o = t.official;
    const left = t.capacityTeams - t.teams.length;
    if (v.isMember)
      return box(
        <>
          {heading("You're signed up!")}
          <p className="mt-1 text-sm text-mist">
            {o.startAt ? `It starts ${formatDayTime(o.startAt)}. ` : "The date will be announced — we'll let you know. "}
            Your matches appear here once Cue Point starts the tournament.
          </p>
          <div className="mt-3 max-w-sm">
            <CountBar label="Players" have={t.teams.length} need={t.capacityTeams} />
          </div>
        </>,
        "ok",
      );
    if (v.signedOut)
      return box(
        <>
          {heading(o.signupClosed ? "Sign-up is closed" : "Want to play?")}
          <p className="mt-1 text-sm text-mist">
            {o.signupClosed
              ? "Every place is taken or the deadline has passed."
              : `${left} place${left === 1 ? "" : "s"} left. Sign in to your Cue Point account to sign up — joining is free.`}
          </p>
          {!o.signupClosed && (
            <Link
              href={`/account?next=${encodeURIComponent(`/tournaments/${o.slug}`)}`}
              className="mt-4 inline-flex rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-8 py-3 text-base font-semibold text-white"
            >
              Sign in to sign up
            </Link>
          )}
        </>,
      );
    if (v.canRegister)
      return box(
        <>
          {heading("Want to play?")}
          <p className="mt-1 text-sm text-mist">
            {left} place{left === 1 ? "" : "s"} left
            {o.entryFee ? ` · entry ${formatLKR(o.entryFee)}, paid at the counter` : " · free entry"}.
          </p>
          <PrimaryButton className="mt-4 px-10 py-3.5 text-base" disabled={busy} onClick={() => onAct("register")}>
            Sign me up
          </PrimaryButton>
        </>,
      );
    return box(
      <>
        {heading(o.signupClosed ? "Sign-up is closed" : "Sign-up is open")}
        <p className="mt-1 text-sm text-mist">
          {t.teams.length} of {t.capacityTeams} players signed up.
        </p>
      </>,
      "plain",
    );
  }

  if (t.status === "registration_open") {
    if (v.invited)
      return box(
        <>
          {heading(`${t.organizer.nickname} invited you`)}
          <p className="mt-1 text-sm text-mist">Do you want to play in this tournament?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton className="px-8 py-3 text-base" disabled={busy} onClick={() => onAct("respond", { accept: true })}>
              Yes, I&apos;m in
            </PrimaryButton>
            <GhostButton className="px-6 py-3" disabled={busy} onClick={onLeave}>
              No thanks
            </GhostButton>
          </div>
        </>,
      );
    if (v.canStart) {
      const enough = t.teamsComplete >= MIN_TEAMS_TO_START;
      return box(
        <>
          {heading(enough ? "Ready when you are" : t.official ? "Waiting for sign-ups" : `Add ${noun}`)}
          <p className="mt-1 text-sm text-mist">
            {t.teamsComplete} of {t.capacityTeams} {noun} {t.official ? "signed up" : "ready"}.{" "}
            {enough
              ? "Press Start and the matches are made for you. Late arrivals? Wait, or start without them."
              : `You need at least ${MIN_TEAMS_TO_START} to start — add them in the ${t.playersPerTeam === 1 ? "Players" : "Teams"} tab.`}
          </p>
          <div className="mt-3 max-w-sm">
            <CountBar label={t.playersPerTeam === 1 ? "Players" : "Teams"} have={t.teamsComplete} need={t.capacityTeams} />
          </div>
          <PrimaryButton className="mt-4 px-10 py-3.5 text-base" disabled={busy || !enough} onClick={() => onAct("start")}>
            ▶ Start tournament
          </PrimaryButton>
        </>,
      );
    }
    return box(
      <>
        {heading("You're in!")}
        <p className="mt-1 text-sm text-mist">
          Waiting for {t.official ? "Cue Point" : t.organizer.nickname} to start. {t.teamsComplete} of {t.capacityTeams} {noun} ready.
        </p>
      </>,
      "plain",
    );
  }

  // in progress
  if (t.myNextGame)
    return box(
      <>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#c4b5fd]">Your match</p>
        <MatchCard g={t.myNextGame} meId={meId} ppt={t.playersPerTeam} onDone={onDone} big />
      </>,
    );
  if (t.pendingTies.length)
    return box(
      <>
        {heading("Tie-breakers")}
        <p className="mt-1 text-sm text-mist">Some players finished level. They play it out — see Play now.</p>
        <PrimaryButton className="mt-3 px-6 py-3" onClick={() => onGo("play")}>
          Show tie-breakers
        </PrimaryButton>
      </>,
    );
  if (readyNow > 0)
    return box(
      <>
        {heading(`${readyNow} match${readyNow === 1 ? "" : "es"} can start now`)}
        <p className="mt-1 text-sm text-mist">Play them side by side on any free table.</p>
        <PrimaryButton className="mt-3 px-6 py-3" onClick={() => onGo("play")}>
          Show matches
        </PrimaryButton>
      </>,
    );
  return box(
    <>
      {heading("Nothing for you to play right now")}
      <p className="mt-1 text-sm text-mist">Waiting for other matches to finish. This page updates by itself.</p>
    </>,
    "plain",
  );
}

/* ============================ tabs ============================ */

function Block({
  title,
  hint,
  empty,
  games,
  meId,
  ppt,
  onDone,
}: {
  title: string;
  hint?: string;
  empty: string;
  games: GameView[];
  meId: string;
  ppt: number;
  onDone: () => Promise<void>;
}) {
  const [all, setAll] = useState(false);
  if (!games.length && !empty) return null;
  const shown = all ? games : games.slice(0, 6);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">
          {title} {games.length > 0 && <span className="text-mist">({games.length})</span>}
        </h2>
        {hint && games.length > 0 && <p className="text-xs text-mist">{hint}</p>}
      </div>
      {games.length === 0 ? (
        <p className="text-sm text-mist">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <MatchCard key={g.id} g={g} meId={meId} ppt={ppt} onDone={onDone} />
          ))}
        </div>
      )}
      {games.length > 6 && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-3 text-sm text-[#c4b5fd] underline">
          {all ? "Show fewer" : `Show all ${games.length}`}
        </button>
      )}
    </section>
  );
}

function StandingsTab({ t, meId, onDone }: { t: TournamentView; meId: string; onDone: () => Promise<void> }) {
  const views = t.sections.filter((s) => s.kind !== "list");
  const [pick, setPick] = useState<string | null>(null);
  if (!views.length) return <p className="text-sm text-mist">Nothing to show yet.</p>;
  const current = views.find((s) => s.id === pick) ?? views.find((s) => s.id === "playoffs" && t.phase === "playoffs") ?? views[0];
  return (
    <div className="space-y-4">
      {views.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {views.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPick(s.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium",
                current.id === s.id ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white" : "border-white/10 text-mist",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      {current.kind === "table" ? (
        <StandingsTable sec={current} meId={meId} ppt={t.playersPerTeam} />
      ) : current.kind === "bracket" ? (
        <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-3">
          {current.rounds.map((r) => (
            <div key={r.round} className="flex w-64 shrink-0 flex-col">
              <RoundHeading name={r.name} className="mb-3 text-sm" />
              <div className="flex flex-1 flex-col justify-around gap-3">
                {r.games.map((g) => (
                  <MatchCard key={g.id} g={g} meId={meId} ppt={t.playersPerTeam} onDone={onDone} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {current.kind === "bracket" && current.rounds.length > 2 && (
        <p className="text-xs text-mist">Swipe sideways to see every round →</p>
      )}
    </div>
  );
}

function StandingsTable({
  sec,
  meId,
  ppt,
}: {
  sec: Extract<TournamentSection, { kind: "table" }>;
  meId: string;
  ppt: number;
}) {
  const mine = (team: TeamView) => team.members.some((m) => m.id === meId);
  const framesShown = sec.rounds.some((r) => r.games.some((g) => g.bestOf > 1));
  const played = sec.rounds.flatMap((r) => r.games).filter((g) => g.status === "completed").length;
  const total = sec.rounds.flatMap((r) => r.games).length;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[320px] text-left text-base">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist">
          <tr>
            <th className="w-12 px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">{ppt === 1 ? "Player" : "Team"}</th>
            <th className="px-2 py-3 text-center font-medium" title="Won">Won</th>
            <th className="px-2 py-3 text-center font-medium" title="Lost">Lost</th>
            {framesShown && <th className="px-2 py-3 text-center font-medium">Frames</th>}
            <th className="px-3 py-3 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {sec.rows.map((r, i) => (
            <tr
              key={r.teamId}
              className={cn(
                "border-t border-white/[0.06]",
                sec.cuts.includes(i + 1) && "border-b-2 border-b-[#a78bfa]/60",
                r.through && "bg-teal/[0.07]",
                mine(r.team) && "bg-[#a78bfa]/[0.1]",
              )}
            >
              <td className="px-3 py-3 tabular-nums text-mist">{r.tied ? `=${r.position}` : r.position}</td>
              <td className="px-3 py-3 font-medium text-white">
                {teamLabel(r.team, ppt)}
                {mine(r.team) && <span className="ml-1.5 text-xs text-[#c4b5fd]">(you)</span>}
                {r.through && <span className="ml-1.5 text-xs font-semibold text-teal">✓ through</span>}
              </td>
              <td className="px-2 py-3 text-center tabular-nums text-white">{r.won}</td>
              <td className="px-2 py-3 text-center tabular-nums text-mist">{r.lost}</td>
              {framesShown && (
                <td className="px-2 py-3 text-center tabular-nums text-mist">
                  {r.framesFor}–{r.framesAgainst}
                </td>
              )}
              <td className="px-3 py-3 text-right font-display font-bold tabular-nums text-white">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/[0.06] px-3 py-2.5 text-xs text-mist">
        A win = 3 points. The purple line: {sec.cutNote.toLowerCase()}. {played} of {total} matches played.
      </p>
    </div>
  );
}

function AllMatches({ t, meId, onDone }: { t: TournamentView; meId: string; onDone: () => Promise<void> }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const groups = t.sections
    .map((s) => ({
      title: s.title,
      rounds:
        s.kind === "list"
          ? [{ round: 1, name: "", games: s.games }]
          : s.rounds.map((r) => ({ round: r.round, name: r.name, games: r.games })),
    }))
    .map((s) => ({
      ...s,
      rounds: s.rounds
        .map((r) => ({ ...r, games: r.games.filter((g) => !g.isBye && (!onlyMine || g.viewer.teamId)) }))
        .filter((r) => r.games.length),
    }))
    .filter((s) => s.rounds.length);
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[
          [false, "Everyone"],
          [true, "Only mine"],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setOnlyMine(v as boolean)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium",
              onlyMine === v ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white" : "border-white/10 text-mist",
            )}
          >
            {label as string}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="text-sm text-mist">No matches to show.</p>}
      {groups.map((s) => (
        <section key={s.title}>
          {t.sections.length > 1 && <h2 className="mb-3 font-display text-lg font-semibold text-white">{s.title}</h2>}
          <div className="space-y-5">
            {s.rounds.map((r) => (
              <div key={r.round}>
                {r.name &&
                  (tierOfRound(r.name) ? (
                    <RoundHeading name={r.name} className="mb-2 text-sm" />
                  ) : (
                    <p className="mb-2 text-sm font-semibold text-mist">{r.name}</p>
                  ))}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {r.games.map((g) => (
                    <MatchCard key={g.id} g={g} meId={meId} ppt={t.playersPerTeam} onDone={onDone} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlayersTab({
  t,
  meId,
  busy,
  draft,
  taken,
  onAct,
  onAdd,
  onClearDraft,
  onError,
}: {
  t: TournamentView;
  meId: string;
  busy: boolean;
  draft: PickedPlayer[];
  taken: Set<string>;
  onAct: (action: string, body?: Record<string, unknown>) => Promise<boolean>;
  onAdd: (p: PickedPlayer) => void;
  onClearDraft: () => void;
  onError: (e: string) => void;
}) {
  const v = t.viewer;
  const ppt = t.playersPerTeam;
  const canAdd = v.canManage && t.teams.length < t.capacityTeams;
  return (
    <div className="space-y-5">
      {canAdd && (
        <Card>
          <p className="text-base font-semibold text-white">Add {ppt === 1 ? "a player" : "a team"}</p>
          {ppt > 1 && (
            <p className="mt-1 text-sm text-mist">
              Pick two people{draft.length === 1 ? ` — ${draft[0].nickname} needs a partner` : ""}.
            </p>
          )}
          <div className="mt-3">
            <PlayerPicker exclude={new Set()} onPick={onAdd} disabled={busy} />
          </div>
          {!t.official && (
            <>
              <p className="mb-2 mt-4 text-sm text-mist">Not a member? Type their name (no points for guest matches):</p>
              <GuestAdder onAdd={onAdd} disabled={busy} />
            </>
          )}
          {draft.length > 0 && (
            <button type="button" onClick={onClearDraft} className="mt-2 text-sm text-mist underline">
              Clear unfinished team
            </button>
          )}
        </Card>
      )}

      <p className="text-sm text-mist">
        {t.teams.length} of {t.capacityTeams} places filled.
      </p>
      {t.teams.length === 0 && <p className="text-sm text-mist">Nobody added yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {t.teams.map((team, i) => (
          <Card key={team.id} className={cn("p-4", team.complete && "border-teal/30")}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-mist">{ppt === 1 ? `#${i + 1}` : `Team ${i + 1}`}</p>
              {t.status === "registration_open" &&
                (team.complete ? (
                  <span className="text-xs font-semibold text-teal">✓ Ready</span>
                ) : (
                  <span className="text-xs font-semibold text-[#ffb066]">Waiting to accept</span>
                ))}
            </div>
            <div className="space-y-3">
              {team.members.map((m) => (
                <PlayerLine
                  key={m.id}
                  player={m}
                  status={t.status === "registration_open" ? m.status : undefined}
                  you={m.id === meId}
                  right={
                    v.canManage ? (
                      <button
                        onClick={() =>
                          m.guest ? onAct("remove-guest", { guestId: m.id }) : onAct("remove-member", { playerId: m.id })
                        }
                        disabled={busy}
                        aria-label={`Remove ${m.nickname}`}
                        className="rounded-lg px-2.5 py-1 text-xs text-mist hover:bg-red-400/20 hover:text-red-300"
                      >
                        Remove
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
            {v.canManage && team.members.length < ppt && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#ffc98f]">This team needs {ppt - team.members.length} more player.</p>
                <PlayerPicker
                  exclude={new Set()}
                  placeholder="Add a partner…"
                  onPick={(p) =>
                    taken.has(p.id)
                      ? onError(`${p.nickname} is already in a team.`)
                      : onAct("add-member", { teamId: team.id, playerId: p.id })
                  }
                  disabled={busy}
                />
                <GuestAdder
                  placeholder="Or a guest's name"
                  disabled={busy}
                  onAdd={(p) => onAct("add-guest", { teamId: team.id, name: p.nickname })}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** how it's played — and, before the start, a way for the organizer to change it */
function FormatCard({
  t,
  busy,
  onSave,
}: {
  t: TournamentView;
  busy: boolean;
  onSave: (s: TournamentSettings) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TournamentSettings>(t.settings);
  const noun = t.playersPerTeam === 1 ? "player" : "team";
  const summary = describe(t.settings, t.capacityTeams);
  return (
    <Card>
      {!editing ? (
        <>
          <p className="text-base font-semibold text-white">{formatLine(t.settings)}</p>
          <p className="mt-1 text-sm text-mist">
            {summary.totalMatches} matches · {summary.perEntry}. Play at your own pace.
          </p>
          <ol className="mt-3 space-y-1 text-sm text-mist">
            {summary.stages.map((st, i) => (
              <li key={i}>
                {i + 1}. <span className="text-white">{st.title}</span> — {st.detail}
              </li>
            ))}
          </ol>
          {t.viewer.canEditFormat && (
            <GhostButton
              className="mt-4"
              onClick={() => {
                setDraft(t.settings);
                setEditing(true);
              }}
            >
              Change how it&apos;s played
            </GhostButton>
          )}
        </>
      ) : (
        <>
          <FormatPicker value={draft} onChange={setDraft} entries={t.capacityTeams} noun={noun} />
          <div className="mt-5 flex gap-2">
            <PrimaryButton
              className="px-6 py-3"
              disabled={busy}
              onClick={async () => {
                if (await onSave(draft)) setEditing(false);
              }}
            >
              Save
            </PrimaryButton>
            <GhostButton onClick={() => setEditing(false)}>Cancel</GhostButton>
          </div>
        </>
      )}
    </Card>
  );
}

/** players level on points at a line that matters — they play it out */
function TieCard({ tie, ppt }: { tie: PendingTie; ppt: number }) {
  const names = tie.teams.map((x) => teamLabel(x, ppt));
  const list = names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join(" and ");
  return (
    <Card className="border-[#ffb066]/40 bg-[#ff9d3d]/[0.06]">
      <p className="text-base font-semibold text-white">⚖️ {list} are level on points</p>
      <p className="mt-1 text-sm text-mist">
        {tie.playoffRound > 1 ? "Still level — so another round: " : ""}
        {tie.teams.length === 2
          ? "they play one more match to decide it."
          : "each plays the others once. Most wins goes through."}{" "}
        {tie.matchesLeft > 0 && `${tie.matchesLeft} tie-breaker match${tie.matchesLeft === 1 ? "" : "es"} below.`}
      </p>
    </Card>
  );
}

/* ============================ the match card ============================ */

function sectionGames(sec: TournamentSection): GameView[] {
  return sec.kind === "list" ? sec.games : sec.rounds.flatMap((r) => r.games);
}

/* Knockout rounds get grander towards the end:
   last 16 (blue) → quarter finals (teal) → semi finals (silver) →
   final (gold); the 3rd-place match is bronze. */
type Tier = "final" | "third" | "semi" | "quarter" | "r16";

/** which tier a round name belongs to ("Semi Finals", "Upper final", …) */
function tierOfRound(name: string | null | undefined): Tier | null {
  switch (name) {
    case "Final":
    case "Grand final":
      return "final";
    case "3rd place":
      return "third";
    case "Semi Finals":
    case "Upper final":
    case "Lower final":
      return "semi";
    case "Quarter Finals":
    case "Upper semi finals":
      return "quarter";
    case "Round of 16":
    case "Upper quarter finals":
      return "r16";
    default:
      return null;
  }
}

function tierOf(g: GameView): Tier | null {
  if (g.stage === "third_place") return "third";
  if (g.stage === "grand_final") return "final";
  if (g.stage === "knockout" || g.stage === "playoff" || g.stage === "upper" || g.stage === "lower")
    return tierOfRound(g.roundName);
  return null;
}

const TIER = {
  final: {
    icon: "🏆",
    heading: "text-gold",
    card: "border-2 border-gold/70 bg-[linear-gradient(160deg,rgba(244,196,48,0.16),rgba(244,196,48,0.03))] shadow-[0_0_40px_-12px_rgba(244,196,48,0.55)]",
    banner: "bg-gold/20 text-gold",
    label: "FINAL · for 1st place",
    winner: "Champion",
    winnerRow: "bg-gold/20 text-white",
  },
  third: {
    icon: "🥉",
    heading: "text-[#e3a06b]",
    card: "border-2 border-[#cd7f32]/70 bg-[linear-gradient(160deg,rgba(205,127,50,0.16),rgba(205,127,50,0.03))]",
    banner: "bg-[#cd7f32]/25 text-[#e3a06b]",
    label: "3rd place match",
    winner: "3rd place",
    winnerRow: "bg-[#cd7f32]/20 text-white",
  },
  semi: {
    icon: "🥈",
    heading: "text-[#dfe5ec]",
    card: "border-2 border-[#c9d1dc]/60 bg-[linear-gradient(160deg,rgba(201,209,220,0.14),rgba(201,209,220,0.02))]",
    banner: "bg-[#c9d1dc]/20 text-[#e8edf3]",
    label: "SEMI FINAL · win to reach the final",
    winner: "Into the final",
    winnerRow: "bg-[#c9d1dc]/15 text-white",
  },
  quarter: {
    icon: "⭐",
    heading: "text-teal",
    card: "border-2 border-teal/50 bg-[linear-gradient(160deg,rgba(0,194,168,0.12),rgba(0,194,168,0.02))]",
    banner: "bg-teal/15 text-teal",
    label: "QUARTER FINAL · win to reach the semis",
    winner: "Into the semis",
    winnerRow: "bg-teal/15 text-white",
  },
  r16: {
    icon: "🎱",
    heading: "text-sky-300",
    card: "border border-sky-400/40 bg-sky-400/[0.04]",
    banner: "bg-sky-400/15 text-sky-300",
    label: "ROUND OF 16 · win to reach the quarter finals",
    winner: "Through",
    winnerRow: "bg-sky-400/15 text-white",
  },
} as const;

/** a round's own banner text (double-elimination rounds say where they lead) */
function bannerText(g: GameView, tier: Tier): string {
  if (g.stage === "grand_final") return "GRAND FINAL · for 1st place";
  if (g.roundName === "Upper final") return "UPPER FINAL · win to reach the grand final";
  if (g.roundName === "Lower final") return "LOWER FINAL · win to reach the grand final";
  return TIER[tier].label;
}

/** heading for a bracket column / a round in the match list */
function RoundHeading({ name, className }: { name: string; className?: string }) {
  const tier = tierOfRound(name);
  return (
    <p className={cn("font-bold uppercase tracking-wide", tier ? TIER[tier].heading : "text-white", className)}>
      {tier ? `${TIER[tier].icon} ` : ""}
      {name}
    </p>
  );
}

function teamLabel(team: TeamView | null, ppt: number): string {
  if (!team) return "TBD";
  return ppt > 1 ? `Team ${team.name}` : team.name;
}

/**
 * One match. Names in big text, a status, and at most one obvious button.
 * Entering a result: "Who won?" → (best-of matches) "What was the score?".
 */
function MatchCard({
  g,
  meId,
  ppt,
  onDone,
  big,
  compact,
}: {
  g: GameView;
  meId: string;
  ppt: number;
  onDone: () => Promise<void>;
  big?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "table" | "result" | "fix">("idle");
  const tables = useContext(TablesContext);
  const v = g.viewer;

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const r = await apiPost(`/api/friends/games/${g.id}/${action}`, body);
    if (!r.ok) setError(r.error);
    else setMode("idle");
    await onDone();
    setBusy(false);
  }

  const mine = (team: TeamView | null) => !!team?.members.some((m) => m.id === meId);
  const reported = g.teamA?.id === g.reportedWinnerTeamId ? g.teamA : g.teamB?.id === g.reportedWinnerTeamId ? g.teamB : null;
  const canEnter = (v.canSettle || v.canReport) && g.status !== "completed" && g.resultStatus !== "reported";
  const resultAction = v.canSettle ? "settle" : "report";

  const status =
    g.isBye
      ? { text: "Free pass", cls: "bg-white/10 text-mist" }
      : g.status === "completed"
        ? { text: "Finished", cls: "bg-white/10 text-mist" }
        : g.status === "in_progress"
          ? { text: g.tableName ? `Playing · ${g.tableName}` : "Playing", cls: "bg-teal/20 text-teal" }
          : g.status === "ready"
            ? { text: "Ready", cls: "bg-[#a78bfa]/20 text-[#c4b5fd]" }
            : g.status === "cancelled"
              ? { text: "Cancelled", cls: "bg-white/10 text-mist" }
              : { text: "Waiting", cls: "bg-white/5 text-mist" };

  const tier = tierOf(g);
  const look = tier ? TIER[tier] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        look
          ? look.card
          : g.status === "in_progress"
            ? "border-teal/40 bg-teal/[0.04]"
            : g.status === "ready"
              ? "border-[#a78bfa]/40 bg-[#a78bfa]/[0.04]"
              : "border-white/10 bg-white/[0.025]",
        big && !look && "border-0 bg-transparent p-0",
        compact && "p-3",
      )}
    >
      {look && (
        <p className={cn("-mx-1 mb-3 rounded-lg px-3 py-1.5 text-center text-xs font-bold uppercase tracking-[0.18em]", look.banner)}>
          {look.icon} {bannerText(g, tier!)}
        </p>
      )}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-mist">
          {g.roundName}
          {g.bestOf > 1 && ` · ${bestOfLabel(g.bestOf)}`}
        </span>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.cls)}>{status.text}</span>
      </div>

      {[g.teamA, g.teamB].map((team, i) => {
        const won = !!g.winnerTeamId && !!team && g.winnerTeamId === team.id;
        const lost = !!g.winnerTeamId && !!team && g.winnerTeamId !== team.id;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3",
              big ? "py-2.5 text-lg" : compact ? "py-1.5 text-sm" : "py-2 text-base",
              won ? cn("font-semibold", look ? look.winnerRow : "bg-[#a78bfa]/15 text-white") : lost ? "text-mist" : "text-white",
            )}
          >
            <span className="truncate">
              {team ? (
                teamLabel(team, ppt)
              ) : g.isBye ? (
                "—"
              ) : (i === 0 ? g.sourceA : g.sourceB) ? (
                <span className="text-mist">{i === 0 ? g.sourceA : g.sourceB}</span>
              ) : (
                "To be decided"
              )}
              {mine(team) && <span className="ml-1.5 text-xs text-[#c4b5fd]">(you)</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {g.status === "completed" && !g.isBye && g.bestOf > 1 && (
                <span className="font-display tabular-nums">{i === 0 ? g.scoreA : g.scoreB}</span>
              )}
              {won && look && (!compact || tier === "final" || tier === "third") && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", look.banner)}>
                  {look.winner}
                </span>
              )}
              {won &&
                (tier === "final" || tier === "third" ? (
                  <span aria-hidden>{look!.icon}</span>
                ) : (
                  <span className="text-sm font-bold text-teal" aria-label="won">✓</span>
                ))}
            </span>
          </div>
        );
      })}

      {/* waiting on the other side */}
      {g.resultStatus === "reported" && (
        <div className="mt-3 rounded-xl bg-[#ff9d3d]/10 p-3">
          <p className="text-sm text-[#ffc98f]">
            {g.reportedBy?.nickname} says <strong>{reported ? teamLabel(reported, ppt) : "?"}</strong> won
            {g.bestOf > 1 && g.reportedScoreA != null ? ` ${g.reportedScoreA}–${g.reportedScoreB}` : ""}.
          </p>
          {v.canConfirm ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <ActionButton primary disabled={busy} onClick={() => act("confirm")}>
                ✓ Yes, that&apos;s right
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => act("dispute")}>
                ✗ No, that&apos;s wrong
              </ActionButton>
            </div>
          ) : (
            <p className="mt-1 text-xs text-mist">Waiting for the other side to say it&apos;s right.</p>
          )}
        </div>
      )}
      {g.resultStatus === "disputed" && g.status !== "completed" && (
        <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">
          The result was questioned. Enter it again{v.canSettle ? "" : ", or ask the organizer"}.
        </p>
      )}

      {/* main buttons */}
      {mode === "idle" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.canStart && g.status === "ready" && (
            <ActionButton primary disabled={busy} onClick={() => (tables.length ? setMode("table") : act("start"))}>
              ▶ Start
            </ActionButton>
          )}
          {canEnter && (
            <ActionButton primary={g.status === "in_progress"} disabled={busy} onClick={() => setMode("result")}>
              Enter result
            </ActionButton>
          )}
          {v.canChange && (
            <button type="button" onClick={() => setMode("fix")} className="px-1 text-xs text-mist underline">
              Fix result
            </button>
          )}
        </div>
      )}

      {mode === "table" && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-white">Which table?</p>
          <div className="flex flex-wrap gap-2">
            {tables.map((name) => (
              <ActionButton key={name} disabled={busy} onClick={() => act("start", { tableName: name })}>
                {name}
              </ActionButton>
            ))}
            <ActionButton disabled={busy} onClick={() => act("start")}>
              Doesn&apos;t matter
            </ActionButton>
          </div>
          <button type="button" onClick={() => setMode("idle")} className="mt-2 text-xs text-mist underline">
            Back
          </button>
        </div>
      )}

      {(mode === "result" || mode === "fix") && (
        <ResultEntry
          g={g}
          ppt={ppt}
          busy={busy}
          fixing={mode === "fix"}
          onSave={(body) => act(mode === "fix" ? "settle" : resultAction, body)}
          onUndo={() => {
            if (window.confirm("Undo this result? The match goes back to not played.")) void act("undo");
          }}
          onBack={() => setMode("idle")}
        />
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

/** "Who won?" — then, for a best-of match, "What was the score?" */
function ResultEntry({
  g,
  ppt,
  busy,
  fixing,
  onSave,
  onUndo,
  onBack,
}: {
  g: GameView;
  ppt: number;
  busy: boolean;
  fixing: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onUndo: () => void;
  onBack: () => void;
}) {
  const [winner, setWinner] = useState<"a" | "b" | null>(null);
  const sides = [g.teamA, g.teamB];
  const pickWinner = (i: 0 | 1) => {
    const team = sides[i]!;
    if (g.bestOf <= 1) onSave({ winnerTeamId: team.id });
    else setWinner(i === 0 ? "a" : "b");
  };
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      {winner === null ? (
        <>
          <p className="mb-2 text-sm font-semibold text-white">Who won?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sides.map((team, i) =>
              team ? (
                <ActionButton
                  key={team.id}
                  big
                  disabled={busy || (fixing && g.bestOf <= 1 && g.winnerTeamId === team.id)}
                  onClick={() => pickWinner(i as 0 | 1)}
                >
                  {teamLabel(team, ppt)}
                </ActionButton>
              ) : null,
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm font-semibold text-white">
            {teamLabel(sides[winner === "a" ? 0 : 1], ppt)} won. What was the score?
          </p>
          <p className="mb-2 text-xs text-mist">
            {bestOfLabel(g.bestOf)} — first to {framesToWin(g.bestOf)} frames.
          </p>
          <div className="flex flex-wrap gap-2">
            {winningScores(g.bestOf).map(([w, l]) => {
              const a = winner === "a" ? w : l;
              const b = winner === "a" ? l : w;
              const same = fixing && g.scoreA === a && g.scoreB === b;
              return (
                <ActionButton
                  key={`${w}-${l}`}
                  big
                  disabled={busy || same}
                  onClick={() => onSave({ winnerTeamId: sides[winner === "a" ? 0 : 1]!.id, scoreA: a, scoreB: b })}
                >
                  {w} – {l}
                </ActionButton>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={winner === null ? onBack : () => setWinner(null)} className="text-xs text-mist underline">
          Back
        </button>
        {fixing && (
          <button type="button" disabled={busy} onClick={onUndo} className="text-xs text-red-300 underline">
            Undo result (not played)
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  primary,
  big,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; big?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "rounded-xl font-semibold transition-colors disabled:opacity-40",
        big ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm",
        primary
          ? "bg-[linear-gradient(120deg,#a78bfa,#ec4899)] text-navy-950"
          : "border border-white/20 text-white hover:border-[#a78bfa]/60 hover:bg-[#a78bfa]/10",
      )}
    >
      {children}
    </button>
  );
}
