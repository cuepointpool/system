"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { cn } from "@/lib/utils";
import { FORMAT_LIST, FORMATS, type FormatCode } from "@/lib/friends/formats";
import { validateGameRoster } from "@/lib/friends/validate";
import { apiPost } from "./api";
import { PlayerPicker, type PickedPlayer } from "./PlayerPicker";
import { Card, CountBar, GhostButton, Notice, PrimaryButton } from "./ui";

export function NewGame({ me }: { me: PickedPlayer }) {
  const router = useRouter();
  const [format, setFormat] = useState<FormatCode>("1v1");
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<PickedPlayer[]>([me]);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = FORMATS[format];
  const check = useMemo(() => validateGameRoster(f, players.length), [f, players.length]);
  const ppt = f.playersPerTeam;
  const teamA = players.slice(0, ppt);
  const teamB = players.slice(ppt, ppt * 2);
  const extras = players.slice(ppt * 2);

  function add(p: PickedPlayer) {
    setPlayers((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
    setError(null);
  }
  function remove(id: string) {
    setPlayers((cur) => cur.filter((x) => x.id !== id));
    setRemoving(false);
  }
  /** swap a player with the one in the same seat on the other team */
  function swapSides(index: number) {
    setPlayers((cur) => {
      const other = index < ppt ? index + ppt : index - ppt;
      if (other >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }
  function shuffle() {
    setPlayers((cur) => {
      const rest = cur.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      return [cur[0], ...rest];
    });
  }

  async function create() {
    setBusy(true);
    setError(null);
    const r = await apiPost<{ id: string }>("/api/friends/games", {
      name,
      format,
      teamA: teamA.map((p) => p.id),
      teamB: teamB.map((p) => p.id),
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    router.push(`/play/games/${r.data.id}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">1 · Game</p>
          <p className="mt-2 text-sm text-white">
            8-Ball Pool <span className="text-mist">· 9-foot table</span>
          </p>

          <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">2 · Format</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {FORMAT_LIST.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setFormat(opt.code)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  format === opt.code
                    ? "border-[#a78bfa]/70 bg-[#a78bfa]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25",
                )}
              >
                <span className="block font-display text-lg font-semibold text-white">{opt.code}</span>
                <span className="text-xs text-mist">
                  {opt.label.replace(opt.code + " ", "")} · needs{" "}
                  {opt.playersPerTeam * opt.teamsPerMatch} players
                </span>
              </button>
            ))}
          </div>

          <label className="mt-5 block text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
            Game name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Friday Night 8-Ball"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm normal-case tracking-normal text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none"
            />
          </label>
        </Card>

        <Card>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">3 · Add friends</p>
          <div className="mt-3">
            <PlayerPicker exclude={new Set(players.map((p) => p.id))} onPick={add} />
          </div>
          <p className="mt-3 text-xs text-mist">
            Only the players you add can see this game. They&apos;ll get an invitation to accept.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CountBar label="Players" have={players.length} need={check.required} />
          <p
            className={cn(
              "mt-3 text-sm",
              check.state === "ok" ? "text-teal" : check.state === "over" ? "text-red-300" : "text-mist",
            )}
            role="status"
          >
            {check.message}
          </p>

          {check.state === "over" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <GhostButton onClick={() => setRemoving(true)}>
                Remove {check.extra} player{check.extra === 1 ? "" : "s"}
              </GhostButton>
              <GhostButton onClick={() => setFormat(format === "1v1" ? "2v2" : "1v1")}>
                Change format
              </GhostButton>
              <GhostButton danger onClick={() => router.push("/play")}>
                Cancel
              </GhostButton>
            </div>
          )}
          {removing && check.state === "over" && (
            <p className="mt-3 text-xs text-[#ffc98f]">
              Tap the ✕ next to the player you want to remove. Nobody is removed automatically.
            </p>
          )}

          <div className="mt-5 space-y-4">
            <TeamBlock
              title={ppt === 1 ? "Player 1" : "Team A"}
              seats={ppt}
              members={teamA}
              meId={me.id}
              onRemove={remove}
              highlight={removing}
              onSwap={f.teamsPerMatch > 1 ? (i) => swapSides(i) : undefined}
              offset={0}
            />
            <div className="text-center text-xs uppercase tracking-[0.3em] text-mist">vs</div>
            <TeamBlock
              title={ppt === 1 ? "Player 2" : "Team B"}
              seats={ppt}
              members={teamB}
              meId={me.id}
              onRemove={remove}
              highlight={removing}
              onSwap={(i) => swapSides(i + ppt)}
              offset={ppt}
            />
            {extras.length > 0 && (
              <div className="rounded-xl border border-red-400/30 bg-red-400/[0.05] p-3">
                <p className="mb-2 text-xs font-semibold text-red-300">Extra players</p>
                <div className="space-y-2">
                  {extras.map((p) => (
                    <SeatRow key={p.id} p={p} meId={me.id} onRemove={remove} highlight={removing} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {format === "2v2" && players.length > 2 && (
            <button
              type="button"
              onClick={shuffle}
              className="mt-4 text-xs font-medium text-[#c4b5fd] underline-offset-2 hover:underline"
            >
              Shuffle teams
            </button>
          )}
        </Card>

        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={create} disabled={check.state !== "ok" || busy} className="flex-1 py-3">
            {busy ? "Creating…" : "Create game"}
          </PrimaryButton>
          <Link href="/play" className="text-sm text-mist hover:text-white">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({
  title,
  seats,
  members,
  meId,
  onRemove,
  highlight,
  onSwap,
  offset,
}: {
  title: string;
  seats: number;
  members: PickedPlayer[];
  meId: string;
  onRemove: (id: string) => void;
  highlight: boolean;
  onSwap?: (indexInTeam: number) => void;
  offset: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="mb-2 text-xs font-semibold text-mist">{title}</p>
      <div className="space-y-2">
        {Array.from({ length: seats }).map((_, i) => {
          const p = members[i];
          return p ? (
            <SeatRow
              key={p.id}
              p={p}
              meId={meId}
              onRemove={onRemove}
              highlight={highlight}
              onSwap={onSwap && p.id !== meId ? () => onSwap(i) : undefined}
            />
          ) : (
            <div
              key={`empty-${offset}-${i}`}
              className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-mist/70"
            >
              Open seat
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeatRow({
  p,
  meId,
  onRemove,
  highlight,
  onSwap,
}: {
  p: PickedPlayer;
  meId: string;
  onRemove: (id: string) => void;
  highlight: boolean;
  onSwap?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
      <PlayerAvatar name={p.nickname} src={p.avatar} size="xs" />
      <span className="flex-1 truncate text-sm text-white">
        {p.nickname}
        {p.id === meId && <span className="ml-1.5 text-[11px] text-mist">(you · host)</span>}
      </span>
      {onSwap && (
        <button
          type="button"
          onClick={onSwap}
          className="text-[11px] text-mist hover:text-white"
          aria-label={`Move ${p.nickname} to the other team`}
        >
          ⇄ switch
        </button>
      )}
      {p.id !== meId && (
        <button
          type="button"
          onClick={() => onRemove(p.id)}
          aria-label={`Remove ${p.nickname}`}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-xs text-mist hover:bg-red-400/20 hover:text-red-300",
            highlight && "animate-pulse bg-red-400/20 text-red-300",
          )}
        >
          ✕
        </button>
      )}
    </div>
  );
}
