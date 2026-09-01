"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FormDots,
  MembershipBadge,
  PlayerAvatar,
  RankMovement,
  SkillTag,
  StatTile,
} from "./Primitives";
import { MatchCard } from "./MatchCard";
import { MagneticButton } from "@/components/MagneticButton";
import { cn, formatDateShort, formatDayTime } from "@/lib/utils";
import type { PlayerProfileView } from "@/lib/ecosystem/types";

export function ProfileView({ view }: { view: PlayerProfileView }) {
  const { profile, stats, achievements, recentMatches, tournamentHistory, upcomingMatches, membershipPlan } =
    view;

  const spark = [...recentMatches]
    .reverse()
    .map((m) =>
      m.playerAId === profile.id ? m.aPointsAfter : m.bPointsAfter,
    );

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
      {/* hero */}
      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(0,194,168,0.1),rgba(5,16,28,0.5))] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-teal/20 blur-[100px]" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(rgba(0,194,168,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(0,194,168,0.6)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(70%_70%_at_20%_10%,#000,transparent)]" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            >
              <PlayerAvatar
                name={profile.fullName}
                src={profile.avatar}
                size="xl"
                ring
              />
            </motion.div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <SkillTag level={profile.skillLevel} />
                <MembershipBadge tier={profile.membershipTier} />
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold leading-none text-white sm:text-4xl">
                {profile.nickname}
              </h1>
              <p className="mt-1 text-sm text-mist">{profile.fullName}</p>
              <p className="mt-2 max-w-md text-[13px] text-mist/80">{profile.bio}</p>
              <p className="mt-2 text-[11px] text-mist/60">
                Cue Point member since {formatDateShort(profile.joinedAt)}
                {profile.homeTable ? ` · home table: ${profile.homeTable}` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <div className="rounded-2xl border border-teal/25 bg-teal/[0.07] p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-mist/60">
                World rank
              </div>
              <div className="font-display text-4xl font-bold text-teal-bright">
                {stats.rank || "—"}
              </div>
              <div className="mt-1 flex justify-center">
                <RankMovement delta={stats.rankMovement} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-mist/60">
                Points
              </div>
              <div className="font-display text-4xl font-bold text-white">
                {stats.rankingPoints.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] text-mist/60">
                {stats.rankedMatches} ranked
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.18em] text-mist/60">
              Recent form
            </span>
            <FormDots form={stats.recentForm} size="md" />
            {stats.streak !== 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  stats.streak > 0
                    ? "bg-teal/15 text-teal"
                    : "bg-rose-500/15 text-rose-300",
                )}
              >
                {stats.streak > 0
                  ? `${stats.streak}-frame win streak`
                  : `${Math.abs(stats.streak)}-frame slide`}
              </span>
            )}
          </div>
          {spark.length > 3 && <Sparkline points={spark} />}
        </div>
      </section>

      {/* stat grid */}
      <section className="mt-8">
        <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
          Career stats
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Matches" value={stats.matchesPlayed} />
          <StatTile label="Wins" value={stats.wins} accent />
          <StatTile label="Losses" value={stats.losses} />
          <StatTile label="Win rate" value={stats.winPct} suffix="%" decimals={1} />
          <StatTile label="Best break" value={stats.bestBreak} />
          <StatTile label="Titles" value={stats.titlesWon} accent={stats.titlesWon > 0} />
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* left: recent matches */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.28em] text-teal">
              Recent matches
            </h2>
            <Link
              href={`/matches?player=${profile.slug}`}
              className="text-xs text-mist transition-colors hover:text-white"
            >
              Full history →
            </Link>
          </div>
          <div className="space-y-3">
            {recentMatches.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-mist">
                No recorded matches yet.
              </p>
            )}
            {recentMatches.map((m, i) => (
              <MatchCard key={m.id} m={m} perspective={profile.id} delay={i * 0.03} />
            ))}
          </div>
        </section>

        {/* right column */}
        <div className="space-y-8">
          {upcomingMatches.length > 0 && (
            <section>
              <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcomingMatches.map((u) => {
                  const opp =
                    u.playerA.id === profile.id ? u.playerB : u.playerA;
                  return (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center justify-between text-[11px] text-mist">
                        <span>
                          {u.round ?? u.type} {u.tournamentName ? `· ${u.tournamentName}` : ""}
                        </span>
                        <span>{u.tableName}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-mist">vs</span>
                        <Link
                          href={`/players/${opp.slug}`}
                          className="flex items-center gap-2"
                        >
                          <PlayerAvatar name={opp.fullName} src={opp.avatar} size="xs" />
                          <span className="text-sm font-semibold text-white">
                            {opp.nickname}
                          </span>
                          <span className="text-[11px] text-mist">#{opp.rank}</span>
                        </Link>
                      </div>
                      <div className="mt-1.5 text-[11px] text-teal">
                        {formatDayTime(u.scheduledAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
              Achievements
            </h2>
            {achievements.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-mist">
                No badges yet — win a frame to get started.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "group rounded-xl border p-3 transition-colors",
                      TIER_BORDER[a.tier],
                    )}
                    title={a.description}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        TIER_BG[a.tier],
                      )}
                    >
                      <AchievementIcon name={a.icon} />
                    </div>
                    <div className="mt-2 text-[12px] font-semibold text-white">
                      {a.name}
                    </div>
                    <div className="text-[10px] text-mist/70">{a.description}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
              Tournament history
            </h2>
            {tournamentHistory.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-mist">
                Hasn&apos;t entered a tournament yet.
              </p>
            ) : (
              <div className="space-y-2">
                {tournamentHistory.map((t) => (
                  <Link
                    key={t.tournamentId}
                    href={`/tournaments/${t.slug}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-teal/25"
                  >
                    <span className="text-sm text-white">{t.name}</span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        t.placement === "Champion" ? "text-teal-bright" : "text-mist",
                      )}
                    >
                      {t.placement ?? statusLabel(t.status)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {membershipPlan && (
            <section>
              <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
                Membership
              </h2>
              <div className="rounded-2xl border border-teal/20 bg-teal/[0.05] p-5">
                <div className="flex items-center justify-between">
                  <MembershipBadge tier={profile.membershipTier} />
                  <span className="text-[11px] text-mist">
                    {profile.membershipStatus === "active"
                      ? profile.membershipExpiry
                        ? `Renews ${formatDateShort(profile.membershipExpiry)}`
                        : "Active"
                      : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white">{membershipPlan.name} — {membershipPlan.tagline}</p>
                <ul className="mt-3 space-y-1.5">
                  {membershipPlan.benefits.slice(0, 3).map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[12px] text-mist">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-teal" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/membership"
                  className="mt-4 inline-block text-xs font-medium text-teal"
                >
                  Compare plans →
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <MagneticButton href="/book">Book a table</MagneticButton>
        <MagneticButton href="/rankings" variant="ghost">
          See the full board
        </MagneticButton>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 160;
  const h = 40;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - ((p - min) / range) * h}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={up ? "#2af0d6" : "#fb7185"} stopOpacity="0.35" />
          <stop offset="1" stopColor="#05101c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#spk)" />
      <motion.path
        d={d}
        fill="none"
        stroke={up ? "#2af0d6" : "#fb7185"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

const TIER_BORDER: Record<string, string> = {
  bronze: "border-amber-700/30",
  silver: "border-slate-300/20",
  gold: "border-amber-400/30",
  platinum: "border-teal-bright/40",
};
const TIER_BG: Record<string, string> = {
  bronze: "bg-amber-700/15 text-amber-300",
  silver: "bg-slate-300/12 text-slate-200",
  gold: "bg-amber-400/15 text-amber-300",
  platinum: "bg-teal-bright/15 text-teal-bright",
};

function statusLabel(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AchievementIcon({ name }: { name: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "trophy":
      return (
        <svg {...c}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4l1 4H9z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...c}>
          <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 2-5 2-9z" />
        </svg>
      );
    case "sword":
      return (
        <svg {...c}>
          <path d="M14 3l7 7-4 1-1 4-7-7zM5 19l3-3M3 21l2-2" />
        </svg>
      );
    case "break":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "podium":
      return (
        <svg {...c}>
          <path d="M9 13h6v7H9zM3 16h6v4H3zM15 10h6v10h-6z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...c}>
          <path d="M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z" />
        </svg>
      );
    case "ladder":
      return (
        <svg {...c}>
          <path d="M8 3v18M16 3v18M8 8h8M8 13h8M8 18h8" />
        </svg>
      );
    case "star":
      return (
        <svg {...c}>
          <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9z" />
        </svg>
      );
    case "flag":
      return (
        <svg {...c}>
          <path d="M5 3v18M5 4h12l-2 4 2 4H5" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...c}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "crown":
      return (
        <svg {...c}>
          <path d="M3 8l4 4 5-7 5 7 4-4v10H3z" />
        </svg>
      );
    default:
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      );
  }
}
