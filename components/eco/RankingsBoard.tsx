"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  FormDots,
  PlayerAvatar,
  RankMovement,
  MembershipBadge,
  Tabs,
} from "./Primitives";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, RankingScope } from "@/lib/ecosystem/types";

const SCOPES: { value: RankingScope; label: string }[] = [
  { value: "all_time", label: "All-time" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "tournament", label: "Tournament" },
];

export function RankingsBoard({
  initial,
  initialScope = "all_time",
}: {
  initial: LeaderboardRow[];
  initialScope?: RankingScope;
}) {
  const [scope, setScope] = useState<RankingScope>(initialScope);
  const [rows, setRows] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scope === initialScope) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(initial);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rankings?scope=${scope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setRows(d.rows))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope, initial, initialScope]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={SCOPES}
          value={scope}
          onChange={(v) => setScope(v as RankingScope)}
        />
        <p className="text-xs text-mist">
          {scope === "weekly"
            ? "Points won in the last 7 days"
            : scope === "monthly"
              ? "Points won in the last 30 days"
              : scope === "tournament"
                ? "Ranked on tournament results only"
                : "Career ranking points"}
        </p>
      </div>

      <Podium players={podium} loading={loading} />

      <motion.ol
        className={cn("mt-4 space-y-2 transition-opacity", loading && "opacity-40")}
      >
        {rest.length > 0 && (
          <li className="hidden grid-cols-[3rem_1fr_5rem_5rem_7rem_6rem_5rem] gap-3 px-4 pb-1 text-[10px] uppercase tracking-[0.16em] text-mist/50 lg:grid">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-center">Played</span>
            <span className="text-center">W / L</span>
            <span>Win rate</span>
            <span className="text-right">Points</span>
            <span className="text-right">Form</span>
          </li>
        )}
        <AnimatePresence initial={false}>
          {rest.map((r, i) => (
            <Row key={r.id} row={r} delay={i * 0.015} />
          ))}
        </AnimatePresence>
        {rows.length === 0 && (
          <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-mist">
            No ranked results in this window yet.
          </li>
        )}
      </motion.ol>
    </div>
  );
}

function Podium({
  players,
  loading,
}: {
  players: LeaderboardRow[];
  loading: boolean;
}) {
  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const heights = ["sm:mt-8", "", "sm:mt-14"];
  return (
    <div
      className={cn(
        "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end",
        loading && "opacity-40",
      )}
    >
      {order.map((idx, slot) => {
        const p = players[idx];
        if (!p) return <div key={slot} className="hidden sm:block" />;
        const isFirst = idx === 0;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: slot * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={heights[slot]}
          >
            <Link
              href={`/players/${p.slug}`}
              data-cursor="hot"
              className={cn(
                "group relative block overflow-hidden rounded-3xl border p-5 text-center transition-all duration-300 hover:-translate-y-1",
                isFirst
                  ? "border-teal/40 bg-[linear-gradient(160deg,rgba(0,194,168,0.14),rgba(5,16,28,0.4))] shadow-[0_30px_80px_-40px_rgba(0,194,168,0.5)]"
                  : "border-white/12 bg-white/[0.03] hover:border-teal/25",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -inset-24 -z-10 opacity-60 blur-3xl",
                  isFirst ? "bg-teal/20" : "bg-navy-700/40",
                )}
              />
              <div className="mb-3 flex items-center justify-center gap-2">
                <span
                  className={cn(
                    "font-display text-4xl font-bold",
                    isFirst ? "text-teal-bright" : "text-white/80",
                  )}
                >
                  {p.rank}
                </span>
                {isFirst && (
                  <span className="text-lg" aria-hidden>
                    👑
                  </span>
                )}
              </div>
              <PlayerAvatar
                name={p.fullName}
                src={p.avatar}
                size={isFirst ? "xl" : "lg"}
                ring={isFirst}
                className="mx-auto"
              />
              <div className="mt-3 font-display text-lg font-bold text-white">
                {p.nickname}
              </div>
              <div className="mt-0.5 text-xs text-mist">{p.fullName}</div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <MembershipBadge tier={p.membershipTier} />
                <RankMovement delta={p.rankMovement} />
              </div>
              <div
                className={cn(
                  "mx-auto mt-3 inline-flex items-baseline gap-1 rounded-full px-3 py-1",
                  isFirst ? "bg-teal/15" : "bg-white/[0.04]",
                )}
              >
                <span className="font-display text-xl font-bold tabular-nums text-white">
                  {p.rankingPoints.toLocaleString()}
                </span>
                <span className="text-[10px] text-mist">pts</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3 text-xs text-mist">
                <span>
                  {p.wins}-{p.losses}
                </span>
                <span>·</span>
                <span>{p.winPct}%</span>
              </div>
              <div className="mt-3 flex justify-center">
                <FormDots form={p.recentForm} />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function Row({ row, delay }: { row: LeaderboardRow; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* desktop */}
      <Link
        href={`/players/${row.slug}`}
        data-cursor="hot"
        className="hidden grid-cols-[3rem_1fr_5rem_5rem_7rem_6rem_5rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-all duration-300 hover:border-teal/25 hover:bg-white/[0.04] lg:grid"
      >
        <span className="flex items-center gap-1.5">
          <span className="font-display text-lg font-bold text-white/90">
            {row.rank}
          </span>
        </span>
        <span className="flex items-center gap-3 overflow-hidden">
          <PlayerAvatar name={row.fullName} src={row.avatar} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {row.nickname}
            </span>
            <span className="block truncate text-[11px] text-mist">
              {row.fullName}
            </span>
          </span>
        </span>
        <span className="text-center text-sm tabular-nums text-mist">
          {row.matchesPlayed}
        </span>
        <span className="text-center text-sm tabular-nums text-white/90">
          {row.wins}-{row.losses}
        </span>
        <span>
          <WinBar pct={row.winPct} />
        </span>
        <span className="text-right">
          <span className="font-display text-base font-bold tabular-nums text-white">
            {row.rankingPoints.toLocaleString()}
          </span>
          <span className="ml-1.5 inline-block align-middle">
            <RankMovement delta={row.rankMovement} />
          </span>
        </span>
        <span className="flex justify-end">
          <FormDots form={row.recentForm} />
        </span>
      </Link>

      {/* mobile */}
      <div className="lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 text-left"
        >
          <span className="w-6 text-center font-display text-base font-bold text-white/90">
            {row.rank}
          </span>
          <PlayerAvatar name={row.fullName} src={row.avatar} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {row.nickname}
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <FormDots form={row.recentForm} />
            </span>
          </span>
          <span className="text-right">
            <span className="block font-display text-sm font-bold tabular-nums text-white">
              {row.rankingPoints.toLocaleString()}
            </span>
            <RankMovement delta={row.rankMovement} />
          </span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-3 mt-1 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center text-xs">
                <span>
                  <span className="block text-mist">Played</span>
                  <span className="font-semibold text-white">
                    {row.matchesPlayed}
                  </span>
                </span>
                <span>
                  <span className="block text-mist">W / L</span>
                  <span className="font-semibold text-white">
                    {row.wins}-{row.losses}
                  </span>
                </span>
                <span>
                  <span className="block text-mist">Win rate</span>
                  <span className="font-semibold text-white">{row.winPct}%</span>
                </span>
                <Link
                  href={`/players/${row.slug}`}
                  className="col-span-3 mt-1 rounded-lg bg-teal/15 py-2 font-medium text-teal"
                >
                  View profile →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

function WinBar({ pct }: { pct: number }) {
  return (
    <span className="block">
      <span className="mb-1 block text-[11px] tabular-nums text-mist">{pct}%</span>
      <span className="block h-1 overflow-hidden rounded-full bg-white/10">
        <motion.span
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="block h-full rounded-full bg-gradient-to-r from-teal-deep to-teal"
        />
      </span>
    </span>
  );
}

export const RANKING_SCOPES = SCOPES;
