"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { cn } from "@/lib/utils";
import { generateBracket, roundName } from "@/lib/friends/bracket";
import {
  FORMAT_LIST,
  FORMATS,
  MIN_TEAMS_TO_START,
  TOURNAMENT_SIZES,
  type FormatCode,
} from "@/lib/friends/formats";
import { validateTournamentRoster } from "@/lib/friends/validate";
import { apiPost } from "./api";
import { PlayerPicker, type PickedPlayer } from "./PlayerPicker";
import { Card, CountBar, GhostButton, Notice, PrimaryButton } from "./ui";

export function NewTournament({ me }: { me: PickedPlayer }) {
  const router = useRouter();
  const [format, setFormat] = useState<FormatCode>("1v1");
  const [size, setSize] = useState<number>(8);
  const [name, setName] = useState("");
  const [seeding, setSeeding] = useState<"random" | "ranking">("random");
  const [teams, setTeams] = useState<PickedPlayer[][]>([]);
  const [draft, setDraft] = useState<PickedPlayer[]>([]);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = FORMATS[format];
  const ppt = f.playersPerTeam;
  const noun = f.sideNoun; // "player" | "team"
  const playersInTeams = teams.reduce((n, t) => n + t.length, 0);
  const check = useMemo(
    () => validateTournamentRoster(f, size, teams.length, playersInTeams),
    [f, size, teams.length, playersInTeams],
  );

  const bracket = useMemo(() => {
    if (teams.length < MIN_TEAMS_TO_START) return null;
    const b = generateBracket(Array.from({ length: teams.length }, (_, i) => i));
    const rounds = Array.from({ length: b.rounds }, (_, i) => ({
      name: roundName(i + 1, b.rounds),
      matches: b.games.filter((g) => g.round === i + 1 && !g.isBye).length,
    }));
    return { rounds, byes: b.byes };
  }, [teams.length]);

  const taken = (id: string) => teams.some((t) => t.some((p) => p.id === id)) || draft.some((p) => p.id === id);

  function pick(p: PickedPlayer) {
    setError(null);
    if (taken(p.id)) {
      setError(
        ppt === 1
          ? `${p.nickname} is already in this tournament.`
          : `${p.nickname} is already a member of another team in this tournament.`,
      );
      return;
    }
    if (teams.length >= size && draft.length === 0) {
      setError(`This tournament is already full (${teams.length}/${size} ${noun}s).`);
      return;
    }
    const next = [...draft, p];
    if (next.length === ppt) {
      setTeams((cur) => [...cur, next]);
      setDraft([]);
    } else setDraft(next);
  }

  function removeTeam(i: number) {
    setTeams((cur) => cur.filter((_, k) => k !== i));
    setRemoving(false);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const r = await apiPost<{ id: string }>("/api/friends/tournaments", {
      name,
      format,
      capacityTeams: size,
      seeding,
      teams: teams.map((t) => t.map((p) => p.id)),
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    router.push(`/play/tournaments/${r.data.id}`);
  }

  const canCreate = check.state !== "over" && draft.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">1 · Game & format</p>
          <p className="mt-2 text-sm text-white">
            8-Ball Pool <span className="text-mist">· Single elimination · 9-foot tables</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {FORMAT_LIST.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  setFormat(opt.code);
                  setTeams([]);
                  setDraft([]);
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  format === opt.code
                    ? "border-[#a78bfa]/70 bg-[#a78bfa]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25",
                )}
              >
                <span className="block font-display text-lg font-semibold text-white">{opt.code}</span>
                <span className="text-xs text-mist">
                  {opt.playersPerTeam === 1 ? "Every player is an entry" : "Teams of 2 are the entries"}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">2 · Size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOURNAMENT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-left transition-colors",
                  size === s
                    ? "border-[#a78bfa]/70 bg-[#a78bfa]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25",
                )}
              >
                <span className="block font-display text-base font-semibold text-white">
                  {s} {noun}s
                </span>
                <span className="text-[11px] text-mist">
                  {s * ppt} players needed
                </span>
              </button>
            ))}
          </div>
          {format === "2v2" && (
            <p className="mt-3 text-xs text-mist">
              A 2v2 tournament of {size} teams needs {size} × 2 = <strong className="text-white">{size * 2} players</strong>.
            </p>
          )}

          <label className="mt-5 block text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
            Name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="CuePoint Friday 8-Ball Tournament"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm normal-case tracking-normal text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none"
            />
          </label>

          <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">Draw</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["random", "Random draw"],
                ["ranking", "Seed by ranking points"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setSeeding(v)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                  seeding === v
                    ? "border-[#a78bfa]/70 bg-[#a78bfa]/10 text-white"
                    : "border-white/10 text-mist hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
            3 · Add {ppt === 1 ? "players" : "teams"}
          </p>
          {ppt > 1 && (
            <p className="mt-2 text-xs text-mist">
              Pick two friends to make a team{draft.length === 1 ? ` — ${draft[0].nickname} needs a partner` : ""}.
            </p>
          )}
          <div className="mt-3">
            <PlayerPicker exclude={new Set()} onPick={pick} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!taken(me.id) && (
              <button
                type="button"
                onClick={() => pick(me)}
                className="text-xs font-medium text-[#c4b5fd] underline-offset-2 hover:underline"
              >
                + Add myself as a player
              </button>
            )}
            {draft.length > 0 && (
              <button
                type="button"
                onClick={() => setDraft([])}
                className="text-xs text-mist underline-offset-2 hover:underline"
              >
                Clear unfinished team
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-mist">
            Only the players you add can see this tournament. You can keep inviting after you create it.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="space-y-4">
            <CountBar label={ppt === 1 ? "Players" : "Teams"} have={teams.length} need={size} />
            {ppt > 1 && <CountBar label="Players" have={playersInTeams} need={check.players.required} />}
          </div>
          <p
            role="status"
            className={cn(
              "mt-3 text-sm",
              check.state === "ok" ? "text-teal" : check.state === "over" ? "text-red-300" : "text-mist",
            )}
          >
            {check.message}
            {check.state === "short" && teams.length > 0 && " You can invite the rest after creating."}
          </p>

          {check.state === "over" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <GhostButton onClick={() => setRemoving(true)}>
                Remove {teams.length - size} {noun}
                {teams.length - size === 1 ? "" : "s"}
              </GhostButton>
              <GhostButton onClick={() => setSize(TOURNAMENT_SIZES.find((s) => s >= teams.length) ?? 16)}>
                Change size
              </GhostButton>
              <GhostButton danger onClick={() => router.push("/play")}>
                Cancel
              </GhostButton>
            </div>
          )}
          {removing && (
            <p className="mt-3 text-xs text-[#ffc98f]">
              Tap the ✕ next to the {noun} you want to remove. Nobody is removed automatically.
            </p>
          )}

          <ul className="mt-5 space-y-2">
            {teams.map((t, i) => (
              <li key={t.map((p) => p.id).join("+")} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[11px] text-mist">
                  {i + 1}
                </span>
                <span className="flex flex-1 items-center gap-2 truncate text-sm text-white">
                  {t.map((p) => (
                    <PlayerAvatar key={p.id} name={p.nickname} src={p.avatar} size="xs" />
                  ))}
                  <span className="truncate">{t.map((p) => p.nickname).join(" & ")}</span>
                </span>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeTeam(i)}
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-xs text-mist hover:bg-red-400/20 hover:text-red-300",
                    removing && "animate-pulse bg-red-400/20 text-red-300",
                  )}
                >
                  ✕
                </button>
              </li>
            ))}
            {draft.length > 0 && (
              <li className="rounded-xl border border-dashed border-[#a78bfa]/50 px-3 py-2 text-sm text-[#c4b5fd]">
                {draft.map((p) => p.nickname).join(" & ")} + 1 more player to complete this team
              </li>
            )}
            {teams.length === 0 && draft.length === 0 && (
              <li className="text-sm text-mist">No {noun}s added yet.</li>
            )}
          </ul>
        </Card>

        {bracket && (
          <Card>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">
              Bracket (built automatically)
            </p>
            <p className="mt-2 text-xs text-mist">
              With {teams.length} {noun}s the bracket is generated for you when you start.
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {bracket.rounds.map((r) => (
                <li key={r.name} className="flex justify-between text-white">
                  <span>{r.name}</span>
                  <span className="text-mist">
                    {r.matches} match{r.matches === 1 ? "" : "es"}
                  </span>
                </li>
              ))}
            </ol>
            {bracket.byes > 0 && (
              <p className="mt-3 text-xs text-[#ffc98f]">
                {bracket.byes} BYE{bracket.byes === 1 ? "" : "s"} — the top {bracket.byes === 1 ? "seed" : "seeds"} advance
                automatically.
              </p>
            )}
          </Card>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={create} disabled={!canCreate || busy} className="flex-1 py-3">
            {busy ? "Creating…" : "Create tournament"}
          </PrimaryButton>
          <Link href="/play" className="text-sm text-mist hover:text-white">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
