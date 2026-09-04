"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { CrownIcon } from "./Icons";
import type { LeaderboardRow } from "@/lib/ecosystem/types";

/** Stacked player card — never a wide desktop table. */
export function LeaderboardPlayerCard({
  row,
  isYou,
  index,
}: {
  row: LeaderboardRow;
  isYou: boolean;
  index: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.02, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/players/${row.slug}`}
        className={cn(
          "flex min-h-[64px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors active:bg-white/[0.06]",
          isYou
            ? "border-teal/60 bg-teal/[0.07]"
            : "border-white/10 bg-navy-900/60",
        )}
      >
        <span className="w-8 shrink-0 text-center">
          <span className="block font-display text-base font-bold tabular-nums text-white">
            {row.rank}
          </span>
          {isYou && (
            <span className="block text-[9px] font-bold uppercase tracking-wide text-teal">
              You
            </span>
          )}
        </span>
        <PlayerAvatar name={row.fullName} src={row.avatar} size="sm" ring={isYou} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[15px] font-semibold",
              isYou ? "text-teal" : "text-white",
            )}
          >
            {row.nickname}
          </span>
          <span className="block truncate text-[11px] text-mist">
            {row.matchesPlayed} played · {row.winPct}% win rate
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-[15px] font-bold tabular-nums text-teal">
            {row.rankingPoints.toLocaleString()}
          </span>
          <Movement delta={row.rankMovement} />
        </span>
      </Link>
    </motion.li>
  );
}

function Movement({ delta }: { delta: number }) {
  if (delta === 0)
    return <span className="block text-[11px] text-mist/50">—</span>;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "block text-[11px] font-semibold tabular-nums",
        up ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

/** Top-three podium. Gold / silver / bronze rings, gold crown on #1. */
export function Podium({ rows, youId }: { rows: LeaderboardRow[]; youId?: string }) {
  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const ringColor = ["var(--color-gold)", "#c7d2da", "#c98b52"];
  const height = ["h-16", "h-24", "h-12"];

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {order.map((idx, slot) => {
        const p = rows[idx];
        if (!p) return <div key={slot} />;
        const first = idx === 0;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: slot * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            {first && <CrownIcon className="mb-1 h-7 w-7 text-gold drop-shadow-[0_2px_8px_rgba(244,196,48,0.6)]" />}
            <Link href={`/players/${p.slug}`} className="flex flex-col items-center">
              <span
                className="rounded-full p-[2.5px]"
                style={{ background: ringColor[idx] }}
              >
                <PlayerAvatar
                  name={p.fullName}
                  src={p.avatar}
                  size={first ? "lg" : "md"}
                  className="border-2 border-navy-950"
                />
              </span>
              <span className="mt-1.5 max-w-full truncate px-1 text-center text-[13px] font-bold text-white">
                {p.nickname}
              </span>
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: first ? "var(--color-gold)" : "var(--color-teal)" }}
              >
                {p.rankingPoints.toLocaleString()}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-mist/70">
                Rank points
              </span>
            </Link>
            <div
              className={cn(
                "mt-2 grid w-full place-items-center rounded-t-xl border border-b-0 border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent",
                height[idx],
                p.id === youId && "border-teal/50",
              )}
            >
              <span className="font-display text-xl font-bold text-white/80">
                {idx + 1}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
