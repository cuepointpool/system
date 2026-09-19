"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Tabs } from "@/components/eco/Primitives";
import { cn, timeAgo } from "@/lib/utils";
import type {
  GameListItem,
  MyPlay,
  NotificationItem,
  TournamentListItem,
} from "@/lib/friends/types";
import { apiGet, apiPost } from "./api";
import { FriendsLeagueCard } from "./FriendsLeagueCard";
import { useLive, useRequestGuard } from "./live";
import { Card, GhostButton, Notice, PrimaryButton, StatusPill } from "./ui";

type Tab = "games" | "tournaments" | "invitations" | "notifications";

export function PlayHub({ initial, initialTab }: { initial: MyPlay; initialTab: Tab }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notes, setNotes] = useState<{ unread: number; items: NotificationItem[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guard = useRequestGuard();

  const refetch = useCallback(async () => {
    const isCurrent = guard();
    const [me, n] = await Promise.all([
      apiGet<MyPlay>("/api/friends/me"),
      apiGet<{ unread: number; items: NotificationItem[] }>("/api/friends/notifications"),
    ]);
    if (!isCurrent()) return;
    if (me.ok) setData(me.data);
    if (n.ok) setNotes(n.data);
  }, [guard]);

  useLive(["user"], refetch);
  useEffect(() => {
    // notifications aren't part of the server-rendered snapshot
    const t = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(t);
  }, [refetch]);

  const invites = [
    ...data.games.filter((g) => g.invited).map((g) => ({ kind: "game" as const, item: g })),
    ...data.tournaments.filter((t) => t.invited).map((t) => ({ kind: "tournament" as const, item: t })),
  ];
  const unread = notes?.unread ?? data.unread;

  async function respond(kind: "game" | "tournament", id: string, accept: boolean) {
    setBusyId(id);
    setError(null);
    const r = await apiPost(`/api/friends/${kind === "game" ? "games" : "tournaments"}/${id}/respond`, { accept });
    if (!r.ok) setError(r.error);
    await refetch();
    setBusyId(null);
  }

  async function markAllRead() {
    await apiPost("/api/friends/notifications", {});
    await refetch();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Tabs<Tab>
          layoutId="play-tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "games", label: "My Games", count: data.games.length },
            { value: "tournaments", label: "My Tournaments", count: data.tournaments.length },
            { value: "invitations", label: "Invitations", count: invites.length },
            { value: "notifications", label: "Notifications", count: unread },
          ]}
        />

        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {tab === "games" &&
            (data.games.length === 0 ? (
              <Empty
                title="No games yet"
                body="Create a 1v1 or 2v2 8-Ball game and add your friends. It shows up in all their accounts."
                href="/play/new-game"
                cta="Create a game"
              />
            ) : (
              data.games.map((g) => <GameRow key={g.id} g={g} />)
            ))}

          {tab === "tournaments" &&
            (data.tournaments.length === 0 ? (
              <Empty
                title="No tournaments yet"
                body="Set up a friends tournament — the bracket builds itself."
                href="/play/new-tournament"
                cta="Create a tournament"
              />
            ) : (
              data.tournaments.map((t) => <TournamentRow key={t.id} t={t} />)
            ))}

          {tab === "invitations" &&
            (invites.length === 0 ? (
              <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-mist">
                No pending invitations.
              </p>
            ) : (
              invites.map(({ kind, item }) => (
                <Card key={kind + item.id} className="border-[#a78bfa]/30 bg-[#a78bfa]/[0.05]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#c4b5fd]">
                    {kind === "game" ? "Game invitation" : "Tournament invitation"}
                  </p>
                  <Link
                    href={kind === "game" ? `/play/games/${item.id}` : `/play/tournaments/${item.id}`}
                    className="mt-1 block font-display text-lg font-semibold text-white hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-mist">
                    {item.format} · from {item.organizer.nickname}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton disabled={busyId === item.id} onClick={() => respond(kind, item.id, true)}>
                      Accept
                    </PrimaryButton>
                    <GhostButton disabled={busyId === item.id} onClick={() => respond(kind, item.id, false)}>
                      Decline
                    </GhostButton>
                  </div>
                </Card>
              ))
            ))}

          {tab === "notifications" && (
            <>
              {(notes?.items.length ?? 0) > 0 && unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#c4b5fd] underline-offset-2 hover:underline">
                  Mark all as read
                </button>
              )}
              {!notes || notes.items.length === 0 ? (
                <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-mist">
                  Nothing yet. Invitations, results and bracket updates will show up here as they happen.
                </p>
              ) : (
                notes.items.map((n) => {
                  const body = (
                    <div
                      className={cn(
                        "rounded-xl border px-4 py-3",
                        n.read ? "border-white/10 bg-white/[0.02]" : "border-[#a78bfa]/40 bg-[#a78bfa]/[0.07]",
                      )}
                    >
                      <p className="text-sm text-white">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-mist">{timeAgo(n.createdAt)}</p>
                    </div>
                  );
                  return n.href ? (
                    <Link key={n.id} href={n.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    <div key={n.id}>{body}</div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <FriendsLeagueCard points={data.points} />
      </aside>
    </div>
  );
}

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-mist">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-block rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-5 py-2.5 text-sm font-semibold text-navy-950"
      >
        {cta}
      </Link>
    </div>
  );
}

function GameRow({ g }: { g: GameListItem }) {
  return (
    <Link
      href={`/play/games/${g.id}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-[#a78bfa]/40 hover:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-semibold text-white">{g.name}</p>
        <StatusPill status={g.status} kind="game" />
      </div>
      <p className="mt-1 text-xs text-mist">
        {g.format} · Players: {g.joined}/{g.requiredPlayers} · Hosted by {g.organizer.nickname}
        {g.won === true && <span className="ml-2 font-semibold text-[#c4b5fd]">You won</span>}
        {g.won === false && <span className="ml-2 text-mist">You lost</span>}
        {g.invited && <span className="ml-2 font-semibold text-[#ffb066]">Invitation</span>}
      </p>
    </Link>
  );
}

function TournamentRow({ t }: { t: TournamentListItem }) {
  const noun = t.format === "1v1" ? "Players" : "Teams";
  const isFull = t.status === "registration_open" && t.teamsComplete >= t.capacityTeams;
  return (
    <Link
      href={`/play/tournaments/${t.id}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-[#a78bfa]/40 hover:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-semibold text-white">{t.name}</p>
        <StatusPill status={t.status} kind="tournament" full={isFull} />
      </div>
      <p className="mt-1 text-xs text-mist">
        {t.format} · {noun}: {t.teams}/{t.capacityTeams}
        {t.format === "2v2" && ` · Players: ${t.playersJoined}/${t.requiredPlayers}`} · Organized by{" "}
        {t.organizer.nickname}
        {t.nextGameId && <span className="ml-2 font-semibold text-[#c4b5fd]">Your match is ready</span>}
        {t.invited && <span className="ml-2 font-semibold text-[#ffb066]">Invitation</span>}
      </p>
    </Link>
  );
}
