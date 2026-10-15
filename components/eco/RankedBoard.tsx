"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PlayerAvatar } from "./Primitives";
import { cn } from "@/lib/utils";
import { FINISH_LABEL, RANKED_POINTS } from "@/lib/ecosystem/ranked";
import type { RankedLeaderboardRow } from "@/lib/ecosystem/store";

/* The Ranked leaderboard — points only from tournaments Cue Point hosts. */

const POINT_GUIDE: [string, number][] = [
  ["Champion", RANKED_POINTS.champion],
  ["Runner-up", RANKED_POINTS.runnerUp],
  ["Semi-final", RANKED_POINTS.semiFinal],
  ["Quarter-final", RANKED_POINTS.quarterFinal],
  ["Last 16", RANKED_POINTS.roundOf16],
  ["Took part", RANKED_POINTS.played],
];

export function RankedBoard({ rows, tournaments }: { rows: RankedLeaderboardRow[]; tournaments: number }) {
  if (!rows.length)
    return (
      <div className="mt-8 rounded-[24px] border border-dashed border-gold/30 bg-gold/[0.03] p-10 text-center">
        <p className="text-3xl" aria-hidden>🏆</p>
        <p className="mt-3 font-display text-xl font-bold text-white">The Ranked leaderboard starts with our first tournament</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist">
          Only tournaments hosted by Cue Point count here. When the first one is played, every player who
          took part gets ranking points for how far they went.
        </p>
        <Link href="/tournaments" className="btn-ghost mt-5 inline-block px-5 py-2.5 text-sm">
          See upcoming tournaments
        </Link>
        <PointGuide />
      </div>
    );

  const podium = rows.slice(0, 3);
  return (
    <div>
      <p className="mt-6 text-xs text-mist">
        From {tournaments} Cue Point tournament{tournaments === 1 ? "" : "s"} · points for how far you get in each
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        {[1, 0, 2].map((idx, slot) => {
          const p = podium[idx];
          if (!p) return <div key={slot} className="hidden sm:block" />;
          const first = idx === 0;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: slot * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={["sm:mt-8", "", "sm:mt-14"][slot]}
            >
              <Link
                href={`/players/${p.slug}`}
                className={cn(
                  "block rounded-3xl border p-5 text-center transition-transform duration-300 hover:-translate-y-1",
                  first
                    ? "border-gold/50 bg-[linear-gradient(160deg,rgba(244,196,48,0.14),rgba(5,16,28,0.4))]"
                    : "border-white/12 bg-white/[0.03]",
                )}
              >
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className={cn("font-display text-4xl font-bold", first ? "text-gold" : "text-white/80")}>
                    {idx + 1}
                  </span>
                  {first && <span aria-hidden className="text-lg">🏆</span>}
                </div>
                <PlayerAvatar name={p.fullName} src={p.avatar} size={first ? "xl" : "lg"} ring={first} className="mx-auto" />
                <div className="mt-3 font-display text-lg font-bold text-white">{p.nickname}</div>
                <div className="mt-0.5 text-xs text-mist">{p.fullName}</div>
                <div className="mx-auto mt-3 inline-flex items-baseline gap-1 rounded-full bg-white/[0.05] px-3 py-1">
                  <span className="font-display text-xl font-bold tabular-nums text-white">{p.points}</span>
                  <span className="text-[10px] text-mist">pts</span>
                </div>
                <div className="mt-2 text-xs text-mist">
                  {p.titles > 0 ? `${p.titles} title${p.titles === 1 ? "" : "s"} · ` : ""}
                  {p.tournaments} played · best: {FINISH_LABEL[p.bestFinish]}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <ol className="mt-6 space-y-2">
        <li className="hidden grid-cols-[3rem_1fr_6rem_5rem_6rem_9rem_5rem] gap-3 px-4 pb-1 text-[10px] uppercase tracking-[0.16em] text-mist/50 lg:grid">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-center">Tournaments</span>
          <span className="text-center">Titles</span>
          <span className="text-center">W / L</span>
          <span>Best finish</span>
          <span className="text-right">Points</span>
        </li>
        {rows.map((r, i) => (
          <RankedRow key={r.id} row={r} rank={i + 1} />
        ))}
      </ol>
      <PointGuide />
    </div>
  );
}

function RankedRow({ row, rank }: { row: RankedLeaderboardRow; rank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 px-3 py-3 text-left lg:grid-cols-[3rem_1fr_6rem_5rem_6rem_9rem_5rem] lg:px-4"
      >
        <span className="text-center font-display text-base font-bold text-white/90 lg:text-left lg:text-lg">{rank}</span>
        <span className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={row.fullName} src={row.avatar} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{row.nickname}</span>
            <span className="block truncate text-[11px] text-mist lg:hidden">
              {row.tournaments} played{row.titles ? ` · ${row.titles} 🏆` : ""}
            </span>
            <span className="hidden truncate text-[11px] text-mist lg:block">{row.fullName}</span>
          </span>
        </span>
        <span className="hidden text-center text-sm tabular-nums text-mist lg:block">{row.tournaments}</span>
        <span className="hidden text-center text-sm tabular-nums text-white/90 lg:block">{row.titles || "—"}</span>
        <span className="hidden text-center text-sm tabular-nums text-white/90 lg:block">
          {row.wins}-{row.losses}
        </span>
        <span className="hidden text-sm text-mist lg:block">{FINISH_LABEL[row.bestFinish]}</span>
        <span className="text-right font-display text-base font-bold tabular-nums text-white">{row.points}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          <ul className="space-y-1 text-xs">
            {[...row.results].reverse().map((r) => (
              <li key={r.tournamentId} className="flex justify-between gap-3 text-mist">
                <span className="truncate">
                  <span className="text-white">{r.tournamentName}</span> · {FINISH_LABEL[r.finish]}
                </span>
                <span className="shrink-0 tabular-nums text-white">+{r.points}</span>
              </li>
            ))}
          </ul>
          <Link href={`/players/${row.slug}`} className="mt-2 inline-block text-xs text-teal hover:underline">
            View profile →
          </Link>
        </div>
      )}
    </li>
  );
}

function PointGuide() {
  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mist">Points per Cue Point tournament</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {POINT_GUIDE.map(([label, pts]) => (
          <div key={label} className="rounded-lg bg-white/[0.04] px-2 py-2">
            <div className="font-display text-base font-bold text-white">{pts}</div>
            <div className="text-[10px] text-mist">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
