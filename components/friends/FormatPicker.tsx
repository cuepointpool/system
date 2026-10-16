"use client";

import { useState } from "react";
export { formatLine } from "@/lib/friends/structure";
import { cn } from "@/lib/utils";
import {
  BEST_OF_OPTIONS,
  LIMITS,
  bestOfLabel,
  bestOfSlots,
  describe,
  validateSettings,
  type LeagueFinish,
  type TournamentKind,
  type TournamentSettings,
} from "@/lib/friends/structure";

/* ------------------------------------------------------------------
   How a tournament is played — written for people who just want to
   play pool. Four big, plain choices (one marked "Recommended" for the
   number of players). Only the one question that matters for the
   chosen style is shown; everything else lives under "More options"
   with sensible defaults already set.
   ------------------------------------------------------------------ */

const KINDS: { kind: TournamentKind; title: string; line: string; icon: string }[] = [
  { kind: "knockout", title: "Knockout", line: "Lose a match and you're out. Quick and simple.", icon: "⚔️" },
  { kind: "league", title: "League", line: "Everyone plays everyone. Most wins takes it.", icon: "📋" },
  { kind: "groups", title: "Groups", line: "Small leagues first, then the best play for 1st, 2nd and 3rd.", icon: "🗂️" },
  { kind: "double_elim", title: "Two lives", line: "You're only out after losing twice.", icon: "🔁" },
];

const FINISH_CHOICES: { finish: LeagueFinish; title: string; line: string }[] = [
  { finish: "table", title: "Top of the table wins", line: "No extra matches." },
  { finish: "final", title: "1st and 2nd play a final", line: "One big match at the end." },
  { finish: "top4", title: "Top 4 play semi finals", line: "Then a final." },
  { finish: "top8", title: "Top 8 play quarter finals", line: "Then semis and a final." },
];

/** the style that usually works best for this many entries */
export function recommendedKind(n: number): TournamentKind {
  if (n <= 6) return "league";
  if (n <= 12) return "groups";
  return "knockout";
}

export function FormatPicker({
  value,
  onChange,
  entries,
  noun,
  noLimit = false,
}: {
  value: TournamentSettings;
  onChange: (s: TournamentSettings) => void;
  /** entries the summary is worked out for */
  entries: number;
  /** "player" | "team" */
  noun: string;
  /** official tournament: no cap on players or matches */
  noLimit?: boolean;
}) {
  const s = value;
  const [more, setMore] = useState(false);
  const set = (patch: Partial<TournamentSettings>) => onChange({ ...s, ...patch });
  const maxGroups = Math.max(2, Math.min(LIMITS.maxGroups, Math.floor(entries / LIMITS.minGroupSize)));
  const smallestGroup = Math.floor(entries / Math.max(2, s.groups));
  const problem = validateSettings(s, entries, noLimit);
  const summary = describe(s, entries);
  const table = s.kind === "league" || s.kind === "groups";
  // groups always play a 3rd-place match, so there's nothing to choose
  const hasThird = s.kind === "knockout" || (s.kind === "league" && s.finish !== "table");
  const recommended = recommendedKind(entries);

  return (
    <div className="space-y-5">
      {/* ---- the four styles ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => set({ kind: k.kind })}
            aria-pressed={s.kind === k.kind}
            className={cn(
              "relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
              s.kind === k.kind
                ? "border-[#a78bfa] bg-[#a78bfa]/15"
                : "border-white/10 bg-white/[0.02] hover:border-white/30",
            )}
          >
            <span aria-hidden className="text-2xl leading-none">{k.icon}</span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold text-white">{k.title}</span>
                {k.kind === recommended && (
                  <span className="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal">
                    Recommended
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-mist">{k.line}</span>
            </span>
            {s.kind === k.kind && (
              <span aria-hidden className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[#a78bfa] text-xs font-bold text-navy-950">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---- the one question that matters for this style ---- */}
      {s.kind === "league" && (
        <Question label="How does it end?">
          <div className="grid gap-2 sm:grid-cols-2">
            {FINISH_CHOICES.map((f) => (
              <BigChoice
                key={f.finish}
                on={s.finish === f.finish}
                onClick={() => set({ finish: f.finish })}
                title={f.title}
                line={f.line}
              />
            ))}
          </div>
        </Question>
      )}

      {s.kind === "groups" && (
        <>
          <Question label="How many groups?">
            <Stepper
              value={s.groups}
              min={2}
              max={maxGroups}
              onChange={(groups) => set({ groups })}
              suffix={`about ${Math.floor(entries / s.groups) || "?"} ${noun}s in each`}
            />
          </Question>
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-mist">
            After the groups, the best play on: <span className="text-white">semi finals → a final for 1st and 2nd</span>, and a{" "}
            <span className="text-white">3rd-place match</span>. Every tournament ends with a winner, a runner-up and a 3rd place.
          </p>
          {(
            <Question label="How many go through from each group?">
              <Stepper
                value={s.advance}
                min={Math.min(Math.ceil(4 / s.groups), Math.max(1, smallestGroup - 1))}
                max={Math.max(1, Math.min(4, smallestGroup - 1))}
                onChange={(advance) => set({ advance })}
                suffix={`${s.groups * s.advance} ${noun}s in the knockout`}
              />
            </Question>
          )}
        </>
      )}

      {/* ---- everything else, already set sensibly ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-white">More options</span>
            <span className="block text-xs text-mist">{optionsLine(s)}</span>
          </span>
          <span aria-hidden className={cn("text-mist transition-transform", more && "rotate-180")}>⌄</span>
        </button>
        {more && (
          <div className="space-y-5 border-t border-white/10 px-4 py-4">
            {table && (
              <Question label={`How many times does each ${noun} play each other?`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([1, 2] as const).map((legs) => {
                    const total = describe({ ...s, legs }, entries).stages[0]?.matches ?? 0;
                    return (
                      <BigChoice
                        key={legs}
                        on={s.legs === legs}
                        onClick={() => set({ legs })}
                        title={legs === 1 ? "Once" : "Twice"}
                        line={
                          legs === 1
                            ? `Every ${noun} meets every other ${noun} one time — ${total} ${s.kind === "groups" ? "group" : "league"} matches.`
                            : `Every pair meets two times — ${total} matches. Fairer, but takes twice as long.`
                        }
                      />
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-mist">
                  Only the {s.kind === "groups" ? "group" : "league"} matches. Finals and tie-breakers are always played once.
                </p>
              </Question>
            )}
            {hasThird && (
              <Question label="Play for 3rd place?">
                <Chips
                  value={s.thirdPlace ? "yes" : "no"}
                  onChange={(v) => set({ thirdPlace: v === "yes" })}
                  options={[
                    ["yes", "Yes"],
                    ["no", "No"],
                  ]}
                />
              </Question>
            )}
            {table && (
              <Question label="If two finish on the same points, how is it decided?">
                <p className="mb-2 text-xs text-mist">
                  Only when it matters — who wins, who makes the final, who goes through.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <BigChoice
                    on={s.tiebreak === "decider"}
                    onClick={() => set({ tiebreak: "decider" })}
                    title="They play an extra match"
                    line="Always a tie-breaker match. Three or more level? Each plays the others once."
                  />
                  <BigChoice
                    on={s.tiebreak === "h2h"}
                    onClick={() => set({ tiebreak: "h2h" })}
                    title="Whoever won their match goes through"
                    line="If they already played and one won, no extra match. Otherwise they play one."
                  />
                </div>
                <p className="mt-1.5 text-xs text-mist">
                  Always settled by playing — never a coin toss or anyone choosing.
                </p>
              </Question>
            )}
            <MatchLength value={s} onChange={onChange} entries={entries} />
          </div>
        )}
      </div>

      {/* ---- what they'll get, in words ---- */}
      <div className="rounded-2xl border border-[#a78bfa]/30 bg-[#a78bfa]/[0.06] p-4">
        {problem ? (
          <p className="text-sm text-[#ffc98f]">{problem}</p>
        ) : (
          <>
            <p className="text-sm text-white">
              With {entries} {noun}s: <strong>{summary.totalMatches} matches</strong>.{" "}
              <span className="text-mist">{summary.perEntry}.</span>
            </p>
            <ol className="mt-2 space-y-1 text-xs text-mist">
              {summary.stages.map((st, i) => (
                <li key={i}>
                  {i + 1}. <span className="text-white">{st.title}</span> — {st.detail}
                  {st.matches > 0 ? ` (${st.matches} match${st.matches === 1 ? "" : "es"})` : ""}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-mist">
              Play at your own pace — one evening or several days. Nothing expires.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** "Single frame · 3rd-place match · play each other once" */
function optionsLine(s: TournamentSettings): string {
  const parts: string[] = [];
  const lengths = Object.values(s.bestOf).filter((n) => n > 1);
  parts.push(lengths.length ? "Longer matches set" : "Every match one frame");
  if (s.kind === "league" || s.kind === "groups") parts.push(s.legs === 2 ? "play each other twice" : "play each other once");
  if (s.thirdPlace && (s.kind === "knockout" || (s.kind === "league" && s.finish !== "table") || (s.kind === "groups" && s.groupFinish === "knockout")))
    parts.push("3rd-place match");
  return parts.join(" · ");
}

/** "League · Final: 1st v 2nd · 3rd-place match" — one plain line for headers */
/** best of 1 / 3 / 5 / 7 / 9 — chosen per round */
function MatchLength({
  value,
  onChange,
  entries,
}: {
  value: TournamentSettings;
  onChange: (s: TournamentSettings) => void;
  entries: number;
}) {
  const slots = bestOfSlots(value, entries);
  if (!slots.length) return null;
  const get = (k: string) => value.bestOf[k] ?? 1;
  const setOne = (k: string, n: number) =>
    onChange({ ...value, bestOf: { ...value.bestOf, [k]: n as 1 | 3 | 5 | 7 | 9 } });
  const setAll = (n: number) =>
    onChange({ ...value, bestOf: Object.fromEntries(slots.map((k) => [k, n])) as TournamentSettings["bestOf"] });
  const allSame = slots.every((k) => get(k) === get(slots[0]));
  return (
    <Question label="How many frames in a match?">
      <p className="mb-2 text-xs text-mist">
        &ldquo;Best of 3&rdquo; = first to win 2 frames. You can make the final longer than the early rounds.
      </p>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <span className="w-28 shrink-0 text-xs text-mist">All matches</span>
        {BEST_OF_OPTIONS.map((n) => (
          <LengthChip key={n} n={n} on={allSame && get(slots[0]) === n} onClick={() => setAll(n)} />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {slots.map((k) => (
          <li key={k} className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs text-white" title={k}>{k}</span>
            {BEST_OF_OPTIONS.map((n) => (
              <LengthChip key={n} n={n} on={get(k) === n} onClick={() => setOne(k, n)} />
            ))}
          </li>
        ))}
      </ul>
    </Question>
  );
}

function LengthChip({ n, on, onClick }: { n: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={bestOfLabel(n)}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        on ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white" : "border-white/10 text-mist hover:text-white",
      )}
    >
      {n === 1 ? "1 frame" : `Best of ${n}`}
    </button>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-white">{label}</p>
      {children}
    </div>
  );
}

function BigChoice({ on, onClick, title, line }: { on: boolean; onClick: () => void; title: string; line: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-xl border-2 px-4 py-3 text-left transition-colors",
        on ? "border-[#a78bfa] bg-[#a78bfa]/15" : "border-white/10 hover:border-white/30",
      )}
    >
      <span className="block text-sm font-semibold text-white">{title}</span>
      <span className="text-xs text-mist">{line}</span>
    </button>
  );
}

function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            value === v
              ? "border-[#a78bfa] bg-[#a78bfa]/15 text-white"
              : "border-white/10 text-mist hover:text-white",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const btn =
    "grid h-11 w-11 place-items-center rounded-full border border-white/15 text-xl text-white hover:border-[#a78bfa]/60 disabled:opacity-30";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" aria-label="Fewer" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="min-w-[2rem] text-center font-display text-2xl font-semibold text-white">{value}</span>
      <button type="button" aria-label="More" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
      {suffix && <span className="text-sm text-mist">{suffix}</span>}
    </div>
  );
}
