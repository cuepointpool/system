"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { cn } from "@/lib/utils";
import { FORMATS, MAX_TOURNAMENT_TEAMS, MIN_TEAMS_TO_START, type FormatCode } from "@/lib/friends/formats";
import { DEFAULT_SETTINGS, describe, validateSettings, type TournamentSettings } from "@/lib/friends/structure";
import { apiPost } from "./api";
import { FormatPicker, formatLine, recommendedKind } from "./FormatPicker";
import { GuestAdder, PlayerPicker, type PickedPlayer } from "./PlayerPicker";
import { Card, Notice, PrimaryButton } from "./ui";

/* ------------------------------------------------------------------
   Create a tournament — one simple question per screen:
     1. Singles or doubles?   2. Who's playing?
     3. How do you want to play?   4. Check and create
   Big buttons, plain words, Back / Next at the bottom.
   ------------------------------------------------------------------ */

const STEPS = ["Game", "Players", "How to play", "Check"] as const;
const OFFICIAL_STEPS = ["Event", "Players", "How to play", "Check"] as const;

const RULES =
  "8-Ball, World Rules.\nWinner breaks. Standard 3-foul rule.\nBe at the venue 15 minutes before your match.";

/**
 * `official`: Cue Point staff creating a house tournament — the first step
 * asks for the event details instead of singles / doubles (official ones
 * are singles), players sign themselves up later, and guests aren't allowed.
 */
export function NewTournament({ me, official = false }: { me: PickedPlayer | null; official?: boolean }) {
  const router = useRouter();
  const steps = official ? OFFICIAL_STEPS : STEPS;
  const [step, setStep] = useState(0);
  const [event, setEvent] = useState({
    summary: "",
    entryFee: "",
    prizePool: "",
    startAt: "",
    registrationDeadline: "",
    rules: RULES,
  });
  const [format, setFormat] = useState<FormatCode>("1v1");
  const [name, setName] = useState("");
  const [teams, setTeams] = useState<PickedPlayer[][]>([]);
  const [draft, setDraft] = useState<PickedPlayer[]>([]);
  // null = same as the players added (official: 8 to start with, players sign up later)
  const [places, setPlaces] = useState<number | null>(official ? 8 : null);
  const [settings, setSettings] = useState<TournamentSettings>(DEFAULT_SETTINGS);
  const [styleChosen, setStyleChosen] = useState(false);
  const [seeding, setSeeding] = useState<"random" | "ranking">("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = FORMATS[format];
  const ppt = f.playersPerTeam;
  const noun = f.sideNoun; // "player" | "team"
  const size = Math.min(MAX_TOURNAMENT_TEAMS, Math.max(MIN_TEAMS_TO_START, places ?? teams.length));
  // until they pick a style themselves, suggest the one that suits the numbers
  const chosen: TournamentSettings = styleChosen ? settings : { ...settings, kind: recommendedKind(size) };
  const formatProblem = validateSettings(chosen, size);
  const taken = (id: string) => teams.some((t) => t.some((p) => p.id === id)) || draft.some((p) => p.id === id);

  function pick(p: PickedPlayer) {
    setError(null);
    if (taken(p.id)) {
      setError(ppt === 1 ? `${p.nickname} is already in.` : `${p.nickname} is already in a team.`);
      return;
    }
    if (teams.length >= MAX_TOURNAMENT_TEAMS) {
      setError(`That's the most a tournament can have (${MAX_TOURNAMENT_TEAMS}).`);
      return;
    }
    const next = [...draft, p];
    if (next.length === ppt) {
      setTeams((cur) => [...cur, next]);
      setDraft([]);
    } else setDraft(next);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const r = await apiPost<{ id: string; slug: string | null }>("/api/friends/tournaments", {
      name,
      official: official ? event : null,
      format,
      capacityTeams: size,
      seeding,
      settings: chosen,
      teams: teams.map((t) => ({
        playerIds: t.filter((p) => !p.guest).map((p) => p.id),
        guests: t.filter((p) => p.guest).map((p) => p.nickname),
      })),
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    router.push(r.data.slug ? `/tournaments/${r.data.slug}` : `/play/tournaments/${r.data.id}`);
  }

  const canNext =
    (step === 0 && (!official || name.trim().length > 0)) ||
    (step === 1 && (official || teams.length >= MIN_TEAMS_TO_START) && draft.length === 0) ||
    (step === 2 && !formatProblem);

  return (
    <div className="mx-auto max-w-2xl">
      {/* progress */}
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Steps">
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-[#a78bfa]" : "bg-white/10")} />
              <span className={cn("mt-1.5 block text-[11px] font-medium", i === step ? "text-white" : "text-mist")}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-7">
        {step === 0 && official && (
          <EventStep name={name} setName={setName} event={event} setEvent={setEvent} />
        )}

        {step === 0 && !official && (
          <>
            <h2 className="font-display text-2xl font-bold text-white">Singles or doubles?</h2>
            <p className="mt-1 text-sm text-mist">8-Ball on 9-foot tables.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["1v1", "2v2"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    if (code !== format) {
                      setFormat(code);
                      setTeams([]);
                      setDraft([]);
                    }
                  }}
                  aria-pressed={format === code}
                  className={cn(
                    "rounded-2xl border-2 p-5 text-left transition-colors",
                    format === code ? "border-[#a78bfa] bg-[#a78bfa]/15" : "border-white/10 hover:border-white/30",
                  )}
                >
                  <span aria-hidden className="text-2xl">{code === "1v1" ? "👤" : "👥"}</span>
                  <span className="mt-2 block font-display text-xl font-semibold text-white">
                    {code === "1v1" ? "Singles" : "Doubles"}
                  </span>
                  <span className="text-sm text-mist">
                    {code === "1v1" ? "One player against one player" : "Teams of two players"}
                  </span>
                </button>
              ))}
            </div>
            <label className="mt-6 block">
              <span className="text-sm font-semibold text-white">Give it a name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Friday Night 8-Ball"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none"
              />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-display text-2xl font-bold text-white">
              {official ? "How many players?" : <>Who&apos;s playing?</>}
            </h2>
            <p className="mt-1 text-sm text-mist">
              {official
                ? "Set the number of places. Players sign themselves up on the tournament page — you can also add members here now."
                : ppt === 1
                  ? `Add at least ${MIN_TEAMS_TO_START} players. You can add more later.`
                  : `Add teams of two — pick two people for each team. At least ${MIN_TEAMS_TO_START} teams.`}
            </p>
            {me && !official && !taken(me.id) && (
              <button
                type="button"
                onClick={() => pick(me)}
                className="mt-4 w-full rounded-xl border-2 border-dashed border-[#a78bfa]/50 px-4 py-3 text-sm font-semibold text-[#c4b5fd] hover:bg-[#a78bfa]/10"
              >
                + Add me
              </button>
            )}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-white">Find a Cue Point member</p>
              <PlayerPicker exclude={new Set()} onPick={pick} />
            </div>
            {!official && (
              <div className="mt-4">
                <p className="mb-1 text-sm font-semibold text-white">Not a member? Type their name</p>
                <p className="mb-2 text-xs text-mist">They can play, but their matches don&apos;t earn points.</p>
                <GuestAdder onAdd={pick} />
              </div>
            )}
            {draft.length > 0 && (
              <p className="mt-4 rounded-xl border border-dashed border-[#a78bfa]/50 px-4 py-3 text-sm text-[#c4b5fd]">
                {draft.map((p) => p.nickname).join(" & ")} — add one more person to finish this team.{" "}
                <button type="button" onClick={() => setDraft([])} className="underline">
                  Clear
                </button>
              </p>
            )}

            <p className="mb-2 mt-6 text-sm font-semibold text-white">
              {ppt === 1 ? "Players" : "Teams"} ({teams.length})
            </p>
            {teams.length === 0 ? (
              <p className="text-sm text-mist">Nobody yet.</p>
            ) : (
              <ul className="space-y-2">
                {teams.map((t, i) => (
                  <li key={t.map((p) => p.id).join("+")} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <span className="w-5 text-center text-sm text-mist">{i + 1}</span>
                    {t.map((p) => (
                      <PlayerAvatar key={p.id} name={p.nickname} src={p.avatar} size="xs" />
                    ))}
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {t.map((p) => p.nickname).join(" & ")}
                      {t.some((p) => p.guest) && <span className="ml-2 text-xs text-mist">(guest)</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${t.map((p) => p.nickname).join(" & ")}`}
                      onClick={() => setTeams((cur) => cur.filter((_, k) => k !== i))}
                      className="rounded-lg px-3 py-1.5 text-xs text-mist hover:bg-red-400/15 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm text-white">
                Places in the tournament: <strong>{size}</strong>
              </p>
              <p className="mt-0.5 text-xs text-mist">
                {official
                  ? "Sign-up closes by itself when every place is taken."
                  : `Leave room if more ${noun}s will join later — you can invite them from the tournament page.`}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer places"
                  disabled={size <= Math.max(MIN_TEAMS_TO_START, teams.length)}
                  onClick={() => setPlaces(Math.max(MIN_TEAMS_TO_START, teams.length, size - 1))}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-lg text-white disabled:opacity-30"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="More places"
                  disabled={size >= MAX_TOURNAMENT_TEAMS}
                  onClick={() => setPlaces(size + 1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-lg text-white disabled:opacity-30"
                >
                  +
                </button>
                {places !== null && !official && (
                  <button type="button" onClick={() => setPlaces(null)} className="text-xs text-mist underline">
                    Just the {noun}s I added
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-2xl font-bold text-white">How do you want to play?</h2>
            <p className="mb-5 mt-1 text-sm text-mist">Pick one. You can change it any time before you start.</p>
            <FormatPicker
              value={chosen}
              onChange={(s) => {
                setStyleChosen(true);
                setSettings(s);
              }}
              entries={size}
              noun={noun}
            />
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-white">Who plays who first?</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["random", "Random draw"],
                    ["ranking", "Best players kept apart"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSeeding(v)}
                    aria-pressed={seeding === v}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium",
                      seeding === v ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white" : "border-white/10 text-mist",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-2xl font-bold text-white">All set?</h2>
            <dl className="mt-5 divide-y divide-white/10 rounded-xl border border-white/10 text-sm">
              <Row
                k="Name"
                v={name.trim() || `${me?.nickname ?? "Cue Point"}'s ${format === "1v1" ? "singles" : "doubles"} tournament`}
              />
              <Row k="Game" v={format === "1v1" ? "Singles (1 v 1)" : "Doubles (2 v 2)"} />
              <Row k={ppt === 1 ? "Players" : "Teams"} v={`${teams.length} added · ${size} places`} />
              {official && (
                <>
                  <Row k="Entry" v={event.entryFee ? `LKR ${Number(event.entryFee).toLocaleString("en-LK")}` : "Free"} />
                  <Row k="Prize pool" v={event.prizePool ? `LKR ${Number(event.prizePool).toLocaleString("en-LK")}` : "—"} />
                </>
              )}
              <Row k="How to play" v={formatLine(chosen)} />
              <Row k="Matches" v={`${describe(chosen, size).totalMatches} — at your own pace`} />
            </dl>
            <p className="mt-4 text-sm text-mist">
              {official ? (
                <>
                  It goes up on the Tournaments page straight away and players sign themselves up. When enough have
                  signed up, press <strong className="text-white">Start</strong> on the tournament page and the
                  matches are made for you. Enter every result right there.
                </>
              ) : (
                <>
                  Everyone you added gets an invitation. When enough have accepted, press{" "}
                  <strong className="text-white">Start</strong> on the tournament page and the matches are made for you.
                </>
              )}
            </p>
          </>
        )}

        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {step === 1 && teams.length < MIN_TEAMS_TO_START && teams.length > 0 && (
          <p className="mt-4 text-sm text-mist">Add {MIN_TEAMS_TO_START - teams.length} more to continue.</p>
        )}

        {/* back / next */}
        <div className="mt-7 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white hover:border-white/40"
            >
              ← Back
            </button>
          ) : (
            <Link href={official ? "/admin" : "/play"} className="px-2 text-sm text-mist hover:text-white">
              Cancel
            </Link>
          )}
          {step < steps.length - 1 ? (
            <PrimaryButton className="ml-auto px-8 py-3 text-base" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Next →
            </PrimaryButton>
          ) : (
            <PrimaryButton className="ml-auto px-8 py-3 text-base" disabled={busy || !!formatProblem} onClick={create}>
              {busy ? "Creating…" : "Create tournament"}
            </PrimaryButton>
          )}
        </div>
      </Card>
    </div>
  );
}

type EventDetails = {
  summary: string;
  entryFee: string;
  prizePool: string;
  startAt: string;
  registrationDeadline: string;
  rules: string;
};

const field =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none";

/** official tournaments: what players see before they sign up */
function EventStep({
  name,
  setName,
  event,
  setEvent,
}: {
  name: string;
  setName: (v: string) => void;
  event: EventDetails;
  setEvent: (fn: (e: EventDetails) => EventDetails) => void;
}) {
  const set = (k: keyof EventDetails) => (e: { target: { value: string } }) =>
    setEvent((cur) => ({ ...cur, [k]: e.target.value }));
  return (
    <>
      <h2 className="font-display text-2xl font-bold text-white">The event</h2>
      <p className="mt-1 text-sm text-mist">Singles, 8-Ball. Players see all of this when they sign up.</p>
      <label className="mt-5 block">
        <span className="text-sm font-semibold text-white">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Pitipana Masters" className={field} />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-white">One line about it (optional)</span>
        <input value={event.summary} onChange={set("summary")} maxLength={200} placeholder="Our monthly singles knockout" className={field} />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-white">Entry fee, LKR (empty = free)</span>
          <input value={event.entryFee} onChange={set("entryFee")} inputMode="numeric" placeholder="1000" className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Prize pool, LKR (optional)</span>
          <input value={event.prizePool} onChange={set("prizePool")} inputMode="numeric" placeholder="50000" className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Starts (optional)</span>
          <input type="datetime-local" value={event.startAt} onChange={set("startAt")} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Sign up by (optional)</span>
          <input type="datetime-local" value={event.registrationDeadline} onChange={set("registrationDeadline")} className={field} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-white">Rules (one per line)</span>
        <textarea value={event.rules} onChange={set("rules")} rows={4} className={cn(field, "resize-none")} />
      </label>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
      <dt className="w-28 shrink-0 text-mist">{k}</dt>
      <dd className="text-white">{v}</dd>
    </div>
  );
}
