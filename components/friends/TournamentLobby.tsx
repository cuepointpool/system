"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, timeAgo } from "@/lib/utils";
import { MIN_TEAMS_TO_START } from "@/lib/friends/formats";
import type { GameView, TeamView, TournamentView } from "@/lib/friends/types";
import { apiPost } from "./api";
import { LiveDot } from "./GameLobby";
import { PlayerPicker, type PickedPlayer } from "./PlayerPicker";
import { useLiveView } from "./useLiveView";
import { Card, CountBar, GhostButton, Notice, PlayerLine, PrimaryButton, StatusPill } from "./ui";

interface ConfirmInfo {
  complete: number;
  capacity: number;
  dropped: string[];
  byes: number;
}

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

  if (gone) {
    return (
      <Notice tone="warn">
        This tournament is no longer available to you.{" "}
        <Link href="/play" className="underline">Back to Play</Link>
      </Notice>
    );
  }

  const v = t.viewer;
  const noun = t.playersPerTeam === 1 ? "players" : "teams";
  const open = t.status === "registration_open";
  const full = open && t.teams.length >= t.capacityTeams && t.teamsComplete >= t.capacityTeams;
  const missingPlayers = Math.max(0, t.requiredPlayers - t.playersJoined);
  const taken = new Set(t.teams.flatMap((x) => x.members.map((m) => m.id)));
  const canAddTeam = v.canManage && t.teams.length < t.capacityTeams;

  async function addToDraft(p: PickedPlayer) {
    if (taken.has(p.id) || draft.some((d) => d.id === p.id)) {
      setError(
        t.playersPerTeam === 1
          ? `${p.nickname} is already in this tournament.`
          : `${p.nickname} is already a member of another team in this tournament.`,
      );
      return;
    }
    const next = [...draft, p];
    if (next.length === t.playersPerTeam) {
      setDraft([]);
      await act("add-team", { playerIds: next.map((x) => x.id) });
    } else {
      setError(null);
      setDraft(next);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={t.status} kind="tournament" full={full} />
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-mist">
                {t.format} · 8-Ball · single elimination
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{t.name}</h1>
            <p className="mt-1 text-xs text-mist">
              Organized by {t.organizer.nickname}
              {v.isOrganizer ? " (you)" : ""} · created {timeAgo(t.createdAt)} ·{" "}
              {t.seeding === "ranking" ? "seeded by ranking" : "random draw"}
            </p>
          </div>
          <LiveDot />
        </div>

        {open && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <CountBar
              label={t.playersPerTeam === 1 ? "Players" : "Teams"}
              have={t.teams.length}
              need={t.capacityTeams}
            />
            {t.playersPerTeam > 1 && (
              <CountBar label="Players" have={t.playersJoined} need={t.requiredPlayers} />
            )}
          </div>
        )}
        {open && (
          <p className="mt-3 text-sm text-mist">
            {full
              ? "Registration is full. The organizer can start the tournament."
              : missingPlayers > 0
                ? `${missingPlayers} more player${missingPlayers === 1 ? "" : "s"} needed to fill this tournament (${t.playersJoined}/${t.requiredPlayers} have accepted).`
                : `Waiting for everyone to accept.`}
          </p>
        )}
      </Card>

      {t.status === "completed" && t.champion && (
        <Notice tone="ok">
          🏆 Champions: <strong>{teamLabel(t.champion, t.playersPerTeam)}</strong>
          {t.runnerUp ? ` · Runner-up: ${teamLabel(t.runnerUp, t.playersPerTeam)}` : ""}
        </Notice>
      )}
      {t.status === "cancelled" && <Notice tone="error">This tournament was cancelled.</Notice>}

      {v.invited && open && (
        <Card className="border-[#a78bfa]/40 bg-[#a78bfa]/[0.06]">
          <p className="text-sm text-white">
            <strong>{t.organizer.nickname}</strong> invited you to this {t.format} tournament.
          </p>
          <div className="mt-3 flex gap-2">
            <PrimaryButton disabled={busy} onClick={() => act("respond", { accept: true })}>
              Accept
            </PrimaryButton>
            <GhostButton disabled={busy} onClick={async () => (await act("respond", { accept: false })) && router.push("/play")}>
              Decline
            </GhostButton>
          </div>
        </Card>
      )}

      {/* ---------- registration ---------- */}
      {open && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
              {t.playersPerTeam === 1 ? "Players" : "Teams"} ({t.teams.length}/{t.capacityTeams})
            </p>
            {t.teams.length === 0 && <p className="text-sm text-mist">Nobody added yet.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {t.teams.map((team, i) => (
                <Card key={team.id} className={cn(team.complete && "border-teal/30")}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-mist">
                      {t.playersPerTeam === 1 ? `Entry ${i + 1}` : `Team ${i + 1}`}
                    </p>
                    {team.complete ? (
                      <span className="text-[10px] font-semibold text-teal">Complete</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#ffb066]">Incomplete</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {team.members.map((m) => (
                      <PlayerLine
                        key={m.id}
                        player={m}
                        status={m.status}
                        you={m.id === meId}
                        right={
                          v.canManage ? (
                            <button
                              onClick={() => act("remove-member", { playerId: m.id })}
                              disabled={busy}
                              aria-label={`Remove ${m.nickname}`}
                              className="grid h-6 w-6 place-items-center rounded-full text-xs text-mist hover:bg-red-400/20 hover:text-red-300"
                            >
                              ✕
                            </button>
                          ) : null
                        }
                      />
                    ))}
                  </div>
                  {v.canManage && team.members.length < t.playersPerTeam && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-[#ffc98f]">
                        A {t.format} team must contain exactly {t.playersPerTeam} players.
                      </p>
                      <PlayerPicker
                        exclude={new Set()}
                        placeholder="Add a partner…"
                        onPick={(p) =>
                          taken.has(p.id)
                            ? setError(`${p.nickname} is already a member of another team in this tournament.`)
                            : act("add-member", { teamId: team.id, playerId: p.id })
                        }
                        disabled={busy}
                      />
                    </div>
                  )}
                  {v.canManage && (
                    <button
                      onClick={() => act("remove-team", { teamId: team.id })}
                      disabled={busy}
                      className="mt-3 text-[11px] text-mist underline-offset-2 hover:text-red-300 hover:underline"
                    >
                      Remove {t.playersPerTeam === 1 ? "entry" : "team"}
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {canAddTeam && (
              <Card>
                <p className="mb-1 text-sm font-medium text-white">
                  Add {t.playersPerTeam === 1 ? "a player" : "a team"}
                </p>
                {t.playersPerTeam > 1 && (
                  <p className="mb-3 text-xs text-mist">
                    Pick two friends
                    {draft.length === 1 ? ` — ${draft[0].nickname} needs a partner` : ""}.
                  </p>
                )}
                <PlayerPicker exclude={new Set()} onPick={addToDraft} disabled={busy} />
                {draft.length > 0 && (
                  <button
                    onClick={() => setDraft([])}
                    className="mt-2 text-xs text-mist underline-offset-2 hover:underline"
                  >
                    Clear unfinished team
                  </button>
                )}
              </Card>
            )}

            {v.canStart && (
              <Card>
                <p className="text-sm font-medium text-white">Start the tournament</p>
                <p className="mt-1 text-xs text-mist">
                  The bracket is generated automatically from the complete {noun}
                  {t.teamsComplete < t.capacityTeams ? "; any gaps become BYEs" : ""}.
                </p>
                <PrimaryButton
                  className="mt-3"
                  disabled={busy || t.teamsComplete < MIN_TEAMS_TO_START}
                  onClick={() => act("start")}
                >
                  Start tournament
                </PrimaryButton>
                {t.teamsComplete < MIN_TEAMS_TO_START && (
                  <p className="mt-2 text-xs text-mist">
                    At least {MIN_TEAMS_TO_START} complete {noun} are needed ({t.teamsComplete} so far).
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <Card className="border-[#ffb066]/40 bg-[#ff9d3d]/[0.06]">
          <p className="text-sm font-semibold text-white">Start with the current line-up?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist">
            <li>
              {confirm.complete} of {confirm.capacity} {noun} are ready.
            </li>
            {confirm.byes > 0 && (
              <li>
                {confirm.byes} BYE{confirm.byes === 1 ? "" : "s"} will be used — those {noun} advance
                automatically.
              </li>
            )}
            {confirm.dropped.length > 0 && (
              <li>
                Incomplete and left out: {confirm.dropped.join(", ")}.
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <PrimaryButton disabled={busy} onClick={() => act("start", { force: true })}>
              Start anyway
            </PrimaryButton>
            <GhostButton onClick={() => setConfirm(null)}>Keep waiting</GhostButton>
          </div>
        </Card>
      )}

      {/* ---------- bracket ---------- */}
      {t.rounds.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">Bracket</p>
            {t.byes > 0 && (
              <p className="text-xs text-mist">
                {t.byes} BYE{t.byes === 1 ? "" : "s"} — those {noun} advance automatically
              </p>
            )}
          </div>
          <div className="hide-scrollbar flex gap-5 overflow-x-auto pb-3">
            {t.rounds.map((r) => (
              <div key={r.round} className="flex w-72 shrink-0 flex-col">
                <p className="mb-3 text-sm font-semibold text-white">{r.name}</p>
                <div className="flex flex-1 flex-col justify-around gap-4">
                  {r.games.map((g) => (
                    <BracketMatch key={g.id} g={g} meId={meId} ppt={t.playersPerTeam} onDone={refetch} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        {open && v.canLeave && !v.isOrganizer && (
          <GhostButton danger disabled={busy} onClick={async () => (await act("respond", { accept: false })) && router.push("/play")}>
            Leave tournament
          </GhostButton>
        )}
        {v.canCancel && (
          <GhostButton
            danger
            disabled={busy}
            onClick={() => {
              if (window.confirm("Cancel this tournament for everyone?")) void act("cancel");
            }}
          >
            Cancel tournament
          </GhostButton>
        )}
        <Link href="/play" className="text-sm text-mist hover:text-white">
          ← Back to Play
        </Link>
      </div>
    </div>
  );
}

function teamLabel(team: TeamView | null, ppt: number): string {
  if (!team) return "TBD";
  return ppt > 1 ? `Team ${team.name}` : team.name;
}

function BracketMatch({
  g,
  meId,
  ppt,
  onDone,
}: {
  g: GameView;
  meId: string;
  ppt: number;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = g.viewer;

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const r = await apiPost(`/api/friends/games/${g.id}/${action}`, body);
    if (!r.ok) setError(r.error);
    await onDone();
    setBusy(false);
  }

  const mine = (team: TeamView | null) => !!team?.members.some((m) => m.id === meId);
  const reported = g.teamA?.id === g.reportedWinnerTeamId ? g.teamA : g.teamB?.id === g.reportedWinnerTeamId ? g.teamB : null;

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        g.status === "in_progress" || g.status === "ready"
          ? "border-[#a78bfa]/50 bg-[#a78bfa]/[0.05]"
          : "border-white/10 bg-white/[0.025]",
        g.isBye && "opacity-75",
      )}
    >
      {[g.teamA, g.teamB].map((team, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm",
            i === 0 && "mb-1",
            g.winnerTeamId && team && g.winnerTeamId === team.id
              ? "bg-[#a78bfa]/15 font-semibold text-white"
              : "text-mist",
            g.winnerTeamId && team && g.winnerTeamId !== team.id && "line-through decoration-white/20",
          )}
        >
          <span className="truncate">
            {team ? teamLabel(team, ppt) : g.isBye ? "BYE" : "TBD"}
            {mine(team) && <span className="ml-1.5 text-[10px] text-[#c4b5fd]">(you)</span>}
          </span>
          {g.winnerTeamId && team && g.winnerTeamId === team.id && <span aria-hidden>🏆</span>}
        </div>
      ))}

      <p className="mt-2 text-[11px] text-mist">
        {g.isBye
          ? "BYE — automatically advances"
          : g.status === "waiting_for_players"
            ? "Waiting for earlier matches"
            : g.status === "ready"
              ? "Ready to play"
              : g.status === "in_progress"
                ? "In progress"
                : g.status === "completed"
                  ? "Completed"
                  : "Cancelled"}
      </p>

      {g.resultStatus === "reported" && (
        <p className="mt-2 rounded-lg bg-[#ff9d3d]/10 px-2.5 py-1.5 text-[11px] text-[#ffc98f]">
          {g.reportedBy?.nickname} reported {reported ? teamLabel(reported, ppt) : "a winner"}.{" "}
          {v.canConfirm ? "Is that right?" : "Waiting for confirmation."}
        </p>
      )}
      {g.resultStatus === "disputed" && (
        <p className="mt-2 rounded-lg bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-300">
          Result disputed — report again or ask the organizer to settle.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {v.canStart && (
          <SmallButton disabled={busy} onClick={() => act("start")} primary>
            Start match
          </SmallButton>
        )}
        {v.canConfirm && (
          <>
            <SmallButton disabled={busy} onClick={() => act("confirm")} primary>
              Confirm
            </SmallButton>
            <SmallButton disabled={busy} onClick={() => act("dispute")}>
              Dispute
            </SmallButton>
          </>
        )}
        {v.canReport &&
          [g.teamA, g.teamB].map(
            (team) =>
              team && (
                <SmallButton key={team.id} disabled={busy} onClick={() => act("report", { winnerTeamId: team.id })}>
                  {shortName(team)} won
                </SmallButton>
              ),
          )}
      </div>
      {v.canSettle && g.status !== "completed" && !v.canReport && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[g.teamA, g.teamB].map(
            (team) =>
              team && (
                <SmallButton key={team.id} disabled={busy} onClick={() => act("settle", { winnerTeamId: team.id })}>
                  Settle: {shortName(team)}
                </SmallButton>
              ),
          )}
        </div>
      )}
      {v.canSettle && v.canReport && g.status !== "completed" && (
        <details className="mt-2 text-[11px] text-mist">
          <summary className="cursor-pointer">Organizer options</summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[g.teamA, g.teamB].map(
              (team) =>
                team && (
                  <SmallButton key={team.id} disabled={busy} onClick={() => act("settle", { winnerTeamId: team.id })}>
                    Settle: {shortName(team)}
                  </SmallButton>
                ),
            )}
          </div>
        </details>
      )}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

function shortName(team: TeamView): string {
  return team.name.length > 16 ? team.name.slice(0, 15) + "…" : team.name;
}

function SmallButton({
  children,
  primary,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40",
        primary
          ? "bg-[linear-gradient(120deg,#a78bfa,#ec4899)] text-navy-950"
          : "border border-white/15 text-white hover:border-[#a78bfa]/60 hover:bg-[#a78bfa]/10",
      )}
    >
      {children}
    </button>
  );
}
