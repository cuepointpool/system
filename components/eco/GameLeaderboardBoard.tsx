"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PlayerAvatar } from "./Primitives";
import type { CampaignLeaderboardRow } from "@/lib/campaign/progress";

export function GameLeaderboardBoard({ rows }: { rows: CampaignLeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-mist">
        No campaign progress yet — complete a mission in{" "}
        <Link href="/campaign" className="text-teal underline">
          Campaign Mode
        </Link>{" "}
        to appear here.
      </div>
    );
  }

  return (
    <ol className="mt-8 space-y-2">
      <li className="hidden grid-cols-[3rem_1fr_5rem_5rem_7rem] gap-3 px-4 pb-1 text-[10px] uppercase tracking-[0.16em] text-mist/50 lg:grid">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-center">Level</span>
        <span className="text-center">Stars</span>
        <span className="text-right">XP</span>
      </li>
      {rows.map((row, i) => (
        <motion.li
          key={row.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href={`/players/${row.slug}`}
            data-cursor="hot"
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-all duration-300 hover:border-teal/25 hover:bg-white/[0.04] lg:grid-cols-[3rem_1fr_5rem_5rem_7rem]"
          >
            <span className="font-display text-lg font-bold text-white/90">{row.rank}</span>
            <span className="flex items-center gap-3 overflow-hidden">
              <PlayerAvatar name={row.fullName} src={row.avatar} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {row.nickname}
                </span>
                <span className="block truncate text-[11px] text-mist">
                  {row.missionsCompleted} missions
                </span>
              </span>
            </span>
            <span className="hidden text-center text-sm tabular-nums text-mist lg:block">
              Lv {row.level}
            </span>
            <span className="hidden text-center text-sm tabular-nums text-[#f4c430] lg:block">
              ★ {row.stars}
            </span>
            <span className="text-right">
              <span className="font-display text-base font-bold tabular-nums text-teal-bright">
                {row.xp.toLocaleString()}
              </span>
              <span className="ml-1 text-[10px] text-mist">xp</span>
            </span>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}
