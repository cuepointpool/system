"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PlayerAvatar } from "./Primitives";
import { cn, formatDateShort, timeAgo } from "@/lib/utils";
import type { MatchView, PlayerLite } from "@/lib/ecosystem/types";

const TYPE_STYLE: Record<string, string> = {
  ranked: "bg-teal/12 text-teal ring-teal/30",
  tournament: "bg-teal-bright/12 text-teal-bright ring-teal-bright/30",
  casual: "bg-white/[0.06] text-mist ring-white/12",
};

/**
 * One recorded frame. `perspective` (a player id) tints the card
 * as a win / loss for that player; without it the card is neutral.
 */
export function MatchCard({
  m,
  perspective,
  delay = 0,
}: {
  m: MatchView;
  perspective?: string;
  delay?: number;
}) {
  const aWon = m.winnerId === m.playerAId;
  const persWon = perspective ? m.winnerId === perspective : null;
  const showResult = persWon !== null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 transition-colors",
        showResult && persWon
          ? "border-teal/25"
          : showResult && !persWon
            ? "border-rose-500/20"
            : "border-white/10",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          showResult && persWon
            ? "bg-teal"
            : showResult && !persWon
              ? "bg-rose-500/60"
              : "bg-white/10",
        )}
      />
      <div className="flex items-center justify-between gap-2 text-[11px] text-mist">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wide ring-1",
              TYPE_STYLE[m.type],
            )}
          >
            {m.type}
          </span>
          {m.tournamentName && (
            <span className="truncate">
              {m.tournamentName}
              {m.tournamentRound ? ` · ${m.tournamentRound}` : ""}
            </span>
          )}
        </span>
        <span title={formatDateShort(m.playedAt)}>{timeAgo(m.playedAt)}</span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <MatchSide p={m.playerA} won={aWon} isPers={perspective === m.playerA.id} />
        <div className="flex flex-col items-center">
          <span className="font-display text-xl font-bold tabular-nums text-white">
            {m.scoreA}
            <span className="mx-1 text-mist/40">–</span>
            {m.scoreB}
          </span>
          {showResult && (
            <span
              className={cn(
                "mt-0.5 text-[10px] font-bold uppercase tracking-wide",
                persWon ? "text-teal" : "text-rose-300",
              )}
            >
              {persWon ? "Win" : "Loss"}
            </span>
          )}
        </div>
        <MatchSide
          p={m.playerB}
          won={!aWon}
          isPers={perspective === m.playerB.id}
          reverse
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-mist/70">
        <span>{m.tableName}</span>
        {perspective && (
          <PointSwing
            before={
              perspective === m.playerAId ? m.aPointsBefore : m.bPointsBefore
            }
            after={
              perspective === m.playerAId ? m.aPointsAfter : m.bPointsAfter
            }
          />
        )}
      </div>
    </motion.article>
  );
}

function MatchSide({
  p,
  won,
  isPers,
  reverse = false,
}: {
  p: PlayerLite;
  won: boolean;
  isPers: boolean;
  reverse?: boolean;
}) {
  return (
    <Link
      href={`/players/${p.slug}`}
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        reverse && "flex-row-reverse text-right",
      )}
    >
      <PlayerAvatar name={p.fullName} src={p.avatar} size="sm" />
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            won ? "text-white" : "text-mist",
            isPers && "underline decoration-teal/40 underline-offset-2",
          )}
        >
          {p.nickname}
        </span>
        <span className="block text-[11px] text-mist/70">#{p.rank}</span>
      </span>
    </Link>
  );
}

function PointSwing({ before, after }: { before: number; after: number }) {
  const d = after - before;
  if (!d) return <span>{after} pts</span>;
  return (
    <span className={cn("font-medium", d > 0 ? "text-teal" : "text-rose-300")}>
      {d > 0 ? "+" : ""}
      {d} pts → {after}
    </span>
  );
}
