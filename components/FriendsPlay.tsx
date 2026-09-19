"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Pick your format",
    body: "1v1 singles or 2v2 doubles — 8-Ball on our 9-foot tables. The app tells you exactly how many players you need.",
  },
  {
    n: "02",
    title: "Add your friends",
    body: "Search registered players, invite them, and they accept from their own account. Not registered yet? They can sign up in a minute.",
  },
  {
    n: "03",
    title: "The bracket builds itself",
    body: "4, 8 or 16 entrants — odd numbers get automatic BYEs. Report results and winners advance live on every phone.",
  },
] as const;

const PERKS = [
  "Private to the friends you add",
  "Live updates — no refreshing",
  "Friends League points on your profile",
] as const;

export function FriendsPlay() {
  return (
    <section id="friends" className="relative isolate overflow-hidden py-20 sm:py-28 md:py-32">
      <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-[420px] w-[420px] rounded-full bg-[#a78bfa]/15 blur-[130px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-[380px] w-[380px] rounded-full bg-[#ec4899]/12 blur-[130px]" />

      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#c4b5fd]">
                <span className="h-px w-8 bg-[#a78bfa]/50" />
                New · Friends Tournaments
              </span>
              <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[1.02] tracking-tight text-white md:text-[3.5rem]">
                Create your own tournament{" "}
                <span className="bg-[linear-gradient(120deg,#a78bfa,#ec4899)] bg-clip-text text-transparent">
                  with friends
                </span>
              </h2>
              <p className="mt-5 max-w-xl text-mist">
                Turn a night at Cue Point into a proper competition. Set up a 1v1 or 2v2 game or a full
                knockout tournament, add your friends, and play it out on one table — or book a second one
                if the group needs it.
              </p>
            </Reveal>

            <ol className="mt-8 space-y-5">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={0.06 * i}>
                  <li className="flex gap-4">
                    <span className="font-mono text-xs text-[#c4b5fd]">{s.n}</span>
                    <div>
                      <p className="font-display text-lg font-semibold text-white">{s.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-mist">{s.body}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={0.2}>
              <ul className="mt-7 flex flex-wrap gap-2">
                {PERKS.map((p) => (
                  <li
                    key={p}
                    className="rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/[0.07] px-3.5 py-1.5 text-xs text-[#ddd6fe]"
                  >
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/play/new-tournament"
                  data-cursor="hot"
                  className="btn-friends inline-flex items-center gap-2 px-7 py-3.5 text-sm md:text-[15px]"
                >
                  <span aria-hidden>🎱</span>
                  Create a Friends Tournament
                </Link>
                <Link
                  href="/play/new-game"
                  className="text-sm font-medium text-[#c4b5fd] underline-offset-4 hover:underline"
                >
                  or just start a game →
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <BracketArt />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** a small, static picture of a live 2v2 bracket — decoration only */
function BracketArt() {
  return (
    <div
      aria-hidden
      className="relative rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(167,139,250,0.10),rgba(5,16,28,0.6))] p-5 shadow-[0_40px_100px_-40px_rgba(167,139,250,0.5)] sm:p-7"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#c4b5fd]">2v2 · 8-Ball</p>
          <p className="font-display text-lg font-semibold text-white">Friday Night Cup</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-mist">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a78bfa] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#a78bfa]" />
          </span>
          Live
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="space-y-4">
          <Match a="John & Mike" b="Sam & Alex" winner="a" />
          <Match a="David & Zed" b="BYE" winner="a" bye />
        </div>
        <div className="flex flex-col items-center text-[#a78bfa]/60">
          <span className="h-16 w-px bg-current" />
          <span className="my-1 text-[10px] uppercase tracking-widest">semi</span>
          <span className="h-16 w-px bg-current" />
        </div>
        <div>
          <Match a="John & Mike" b="David & Zed" highlight />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Teams", "3/4"],
          ["Players", "6/8"],
          ["Status", "In play"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.04] py-2">
            <p className="font-display text-base font-semibold text-white">{v}</p>
            <p className="text-[10px] uppercase tracking-wider text-mist">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Match({
  a,
  b,
  winner,
  bye,
  highlight,
}: {
  a: string;
  b: string;
  winner?: "a" | "b";
  bye?: boolean;
  highlight?: boolean;
}) {
  const row = (name: string, won: boolean, isBye?: boolean) => (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs ${
        won ? "bg-[#a78bfa]/20 font-semibold text-white" : "text-mist"
      } ${isBye ? "italic" : ""}`}
    >
      <span className="truncate">{name}</span>
      {won && <span>✓</span>}
    </div>
  );
  return (
    <div
      className={`rounded-xl border p-1.5 ${
        highlight ? "border-[#ec4899]/50 bg-[#ec4899]/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {row(a, winner === "a")}
      {row(b, winner === "b", bye)}
      {bye && <p className="px-2.5 pb-1 pt-0.5 text-[10px] text-[#c4b5fd]">BYE — advances automatically</p>}
    </div>
  );
}
