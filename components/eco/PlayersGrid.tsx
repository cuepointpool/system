"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  FormDots,
  MembershipBadge,
  PlayerAvatar,
  RankMovement,
  SkillTag,
  Tabs,
} from "./Primitives";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, SkillLevel } from "@/lib/ecosystem/types";

const SORTS = [
  { value: "ranking", label: "Ranking" },
  { value: "active", label: "Most active" },
  { value: "winrate", label: "Win rate" },
  { value: "recent", label: "Rising" },
];
const SKILLS: (SkillLevel | "all")[] = [
  "all",
  "Pro",
  "Advanced",
  "Intermediate",
  "Amateur",
  "Rookie",
];

export function PlayersGrid({ initial }: { initial: LeaderboardRow[] }) {
  const [sort, setSort] = useState("ranking");
  const [skill, setSkill] = useState<SkillLevel | "all">("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ sort });
      if (skill !== "all") params.set("skill", skill);
      if (q.trim()) params.set("q", q.trim());
      setLoading(true);
      fetch(`/api/players?${params}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setRows(d.players))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [sort, skill, q]);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            tabs={SORTS}
            value={sort}
            onChange={setSort}
            size="sm"
            layoutId="players-sort"
          />
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
            {SKILLS.map((s) => (
              <button
                key={s}
                onClick={() => setSkill(s)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  skill === s
                    ? "border-teal/50 bg-teal/12 text-teal"
                    : "border-white/10 text-mist hover:border-white/25",
                )}
              >
                {s === "all" ? "All levels" : s}
              </button>
            ))}
          </div>
        </div>
        <label className="relative block lg:w-64">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist/60"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M11 11l3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players"
            className="input !pl-9"
          />
        </label>
      </div>

      <div
        className={cn(
          "mt-6 grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3",
          loading && "opacity-50",
        )}
      >
        <AnimatePresence mode="popLayout">
          {rows.map((p, i) => (
            <PlayerCard key={p.id} p={p} delay={Math.min(i, 12) * 0.03} />
          ))}
        </AnimatePresence>
      </div>
      {rows.length === 0 && !loading && (
        <p className="mt-10 text-center text-sm text-mist">
          No players match those filters.
        </p>
      )}
    </div>
  );
}

function PlayerCard({ p, delay }: { p: LeaderboardRow; delay: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal/30 hover:shadow-[0_28px_70px_-36px_rgba(0,194,168,0.4)]"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-teal/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={p.fullName} src={p.avatar} size="md" />
          <div>
            <div className="font-display text-base font-bold text-white">
              {p.nickname}
            </div>
            <div className="text-[11px] text-mist">{p.fullName}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <SkillTag level={p.skillLevel} />
              <MembershipBadge tier={p.membershipTier} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-mist/60">
            Rank
          </div>
          <div className="font-display text-2xl font-bold text-white">
            {p.rank}
          </div>
          <div className="mt-1 flex justify-end">
            <RankMovement delta={p.rankMovement} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
        <Stat k="Matches" v={String(p.matchesPlayed)} />
        <Stat k="Win rate" v={`${p.winPct}%`} />
        <Stat k="Points" v={p.rankingPoints.toLocaleString()} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <FormDots form={p.recentForm} />
        {p.streak !== 0 && (
          <span
            className={cn(
              "text-[11px] font-medium",
              p.streak > 0 ? "text-teal" : "text-rose-300/80",
            )}
          >
            {p.streak > 0 ? `W${p.streak}` : `L${Math.abs(p.streak)}`} streak
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/players/${p.slug}`}
          className="flex-1 rounded-lg bg-white/[0.05] py-2 text-center text-xs font-medium text-white transition-colors hover:bg-white/[0.1]"
        >
          View profile
        </Link>
        <button
          disabled
          title="Player challenges arrive in the next Cue Point update"
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-mist/50"
        >
          Challenge
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-display text-sm font-bold tabular-nums text-white">
        {v}
      </div>
      <div className="text-[10px] text-mist">{k}</div>
    </div>
  );
}
