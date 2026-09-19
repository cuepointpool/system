"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, timeAgo } from "@/lib/utils";
import type { GameView, TeamView } from "@/lib/friends/types";
import { apiPost } from "./api";
import { PlayerPicker } from "./PlayerPicker";
import { useLiveView } from "./useLiveView";
import { Card, CountBar, GhostButton, Notice, PlayerLine, PrimaryButton, StatusPill } from "./ui";

export function GameLobby({ initial, meId }: { initial: GameView; meId: string }) {
  const router = useRouter();
  const { data: g, refetch, gone } = useLiveView(
    initial,
    `/api/friends/games/${initial.id}`,
    "game",
    [`game:${initial.id}`, "user"],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const r = await apiPost(`/api/friends/games/${g.id}/${action}`, body);
    if (!r.ok) setError(r.error);
    await refetch();
    setBusy(false);
    return r.ok;
  }

  if (gone) {
    return (
      <Notice tone="warn">
        This game is no longer available to you. <Link href="/play" className="underline">Back to Play</Link>
      </Notice>
    );
  }

  const v = g.viewer;
  const teams = [g.teamA, g.teamB].filter((t): t is TeamView => !!t);
  const openSeats = teams.reduce((n, t) => n + Math.max(0, g.playersPerTeam - t.members.length), 0);
  const pending = teams.reduce((n, t) => n + t.members.filter((m) => m.status === "invited").length, 0);
  const live = g.status === "ready" || g.status === "in_progress";
  const winner = teams.find((t) => t.id === g.winnerTeamId);
  const reportedWinner = teams.find((t) => t.id === g.reportedWinnerTeamId);

  let hint = "";
  if (g.status === "waiting_for_players") {
    hint =
      openSeats > 0
        ? `Add ${openSeats} more player${openSeats === 1 ? "" : "s"} to continue.`
        : `Waiting for ${pending} player${pending === 1 ? "" : "s"} to accept.`;
  } else if (g.status === "ready") hint = "Everyone is in. Ready to start.";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={g.status} kind="game" />
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-mist">
                  {g.format} · 8-Ball
                </span>
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{g.name}</h1>
              <p className="mt-1 text-xs text-mist">
                Hosted by {g.organizer.nickname}
                {v.isOrganizer ? " (you)" : ""} · created {timeAgo(g.createdAt)}
              </p>
            </div>
            <LiveDot />
          </div>

          <div className="mt-5">
            <CountBar label="Players" have={g.joined} need={g.requiredPlayers} />
            {hint && <p className="mt-2 text-sm text-mist">{hint}</p>}
          </div>
        </Card>

        {g.status === "completed" && winner && (
          <Notice tone="ok">
            🏆 {winner.name} won. The result is final — Friends points have been added to the players&apos; profiles.
          </Notice>
        )}
        {g.status === "cancelled" && <Notice tone="error">This game was cancelled.</Notice>}

        {v.invited && (g.status === "waiting_for_players" || g.status === "ready") && (
          <Card className="border-[#a78bfa]/40 bg-[#a78bfa]/[0.06]">
            <p className="text-sm text-white">
              <strong>{g.organizer.nickname}</strong> invited you to play {g.format}.
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

        {/* teams */}
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t, i) => (
            <Card
              key={t.id}
              className={cn(
                g.winnerTeamId === t.id && "border-[#a78bfa]/60 bg-[#a78bfa]/[0.07]",
                g.status === "completed" && g.winnerTeamId && g.winnerTeamId !== t.id && "opacity-70",
              )}
            >
              <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
                {g.playersPerTeam === 1 ? `Player ${i + 1}` : `Team ${i === 0 ? "A" : "B"}`}
                {g.winnerTeamId === t.id && " · Winner"}
              </p>
              <div className="space-y-3">
                {t.members.map((m) => (
                  <PlayerLine
                    key={m.id}
                    player={m}
                    status={m.status}
                    you={m.id === meId}
                    right={
                      v.canManage && m.id !== g.organizer.id ? (
                        <button
                          onClick={() => act("remove-player", { playerId: m.id })}
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
                {Array.from({ length: Math.max(0, g.playersPerTeam - t.members.length) }).map((_, k) => (
                  <div key={k} className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-mist/70">
                    Open seat
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {v.canManage && openSeats > 0 && (
          <Card>
            <p className="mb-3 text-sm font-medium text-white">
              Add {openSeats} more player{openSeats === 1 ? "" : "s"}
            </p>
            <PlayerPicker
              exclude={new Set(teams.flatMap((t) => t.members.map((m) => m.id)))}
              onPick={(p) => act("add-player", { playerId: p.id })}
              disabled={busy}
            />
          </Card>
        )}

        {/* play + result */}
        {(v.canStart || live) && (
          <Card>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">Play</p>

            {v.canStart && (
              <div className="mt-3">
                <PrimaryButton disabled={busy} onClick={() => act("start")}>
                  Start game
                </PrimaryButton>
              </div>
            )}

            {live && g.status === "in_progress" && g.resultStatus === "none" && (
              <p className="mt-3 text-sm text-mist">Game on. When it&apos;s finished, report who won.</p>
            )}

            {g.resultStatus === "reported" && (
              <div className="mt-3">
                <Notice tone="warn">
                  {g.reportedBy?.nickname ?? "A player"} reported that{" "}
                  <strong>{reportedWinner?.name ?? "a side"}</strong> won.
                  {v.canConfirm
                    ? " Is that right?"
                    : " Waiting for the other side to confirm."}
                </Notice>
                {v.canConfirm && (
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton disabled={busy} onClick={() => act("confirm")}>
                      Confirm result
                    </PrimaryButton>
                    <GhostButton danger disabled={busy} onClick={() => act("dispute")}>
                      Dispute
                    </GhostButton>
                  </div>
                )}
              </div>
            )}

            {g.resultStatus === "disputed" && (
              <div className="mt-3">
                <Notice tone="warn">
                  The result was disputed. Report it again, or ask the organizer to settle it.
                </Notice>
              </div>
            )}

            {v.canReport && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-mist">Who won?</p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((t) => (
                    <GhostButton key={t.id} disabled={busy} onClick={() => act("report", { winnerTeamId: t.id })}>
                      {t.name} won
                    </GhostButton>
                  ))}
                </div>
              </div>
            )}

            {v.canSettle && g.status !== "completed" && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="mb-2 text-xs text-mist">
                  Organizer: set the final result yourself (skips confirmation).
                </p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((t) => (
                    <GhostButton key={t.id} disabled={busy} onClick={() => act("settle", { winnerTeamId: t.id })}>
                      {t.name} won
                    </GhostButton>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <aside className="space-y-4">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">How it works</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mist">
            <li>Everyone invited accepts the game.</li>
            <li>Any player starts it once all seats are filled.</li>
            <li>One player reports the winner, the other side confirms.</li>
            <li>Confirmed results add Friends League points to every player.</li>
          </ol>
        </Card>
        {(v.canLeave || v.canCancel) && (
          <Card>
            <div className="flex flex-wrap gap-2">
              {v.canLeave && (
                <GhostButton danger disabled={busy} onClick={async () => (await act("respond", { accept: false })) && router.push("/play")}>
                  Leave game
                </GhostButton>
              )}
              {v.canCancel && (
                <GhostButton
                  danger
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Cancel this game for everyone?")) void act("cancel");
                  }}
                >
                  Cancel game
                </GhostButton>
              )}
            </div>
          </Card>
        )}
        <Link href="/play" className="block text-sm text-mist hover:text-white">
          ← Back to Play
        </Link>
      </aside>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-mist">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a78bfa] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#a78bfa]" />
      </span>
      Live
    </span>
  );
}

export { LiveDot };
