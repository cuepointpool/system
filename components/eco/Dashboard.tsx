"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FormDots,
  MembershipBadge,
  PlayerAvatar,
  RankMovement,
  SkillTag,
} from "./Primitives";
import { MatchCard } from "./MatchCard";
import { cn, formatDateShort, formatDayTime, timeAgo } from "@/lib/utils";
import type {
  LoyaltyTransaction,
  MembershipPlan,
  PlayerProfileView,
} from "@/lib/ecosystem/types";

export function Dashboard({
  view,
  loyalty,
  membershipPlan,
  completion,
  registeredTournaments,
}: {
  view: PlayerProfileView;
  loyalty: LoyaltyTransaction[];
  membershipPlan: MembershipPlan | null;
  completion: number;
  registeredTournaments: { name: string; slug: string; startAt: string }[];
}) {
  const { profile, stats, recentMatches, upcomingMatches } = view;
  const nextMatch = upcomingMatches[0];
  const lifetime = profile.loyaltyLifetime;
  const nextRewardAt = Math.ceil((profile.loyaltyPoints + 1) / 800) * 800;
  const progress = Math.min(
    100,
    Math.round((profile.loyaltyPoints / nextRewardAt) * 100),
  );

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-5 rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(0,194,168,0.1),rgba(5,16,28,0.5))] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div className="flex items-center gap-4">
          <PlayerAvatar name={profile.fullName} src={profile.avatar} size="lg" ring />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-teal">
              Player control centre
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
              Welcome back, {profile.nickname}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SkillTag level={profile.skillLevel} />
              <MembershipBadge tier={profile.membershipTier} />
              <span className="text-[11px] text-mist">
                Member since {formatDateShort(profile.joinedAt)}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/players/${profile.slug}`}
          className="btn-ghost px-5 py-2.5 text-sm"
        >
          View public profile
        </Link>
      </motion.div>

      {/* bento */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* ranking */}
        <Card title="Your ranking" span={1}>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-5xl font-bold text-white">
                #{stats.rank || "—"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-mist">
                <RankMovement delta={stats.rankMovement} />
                <span>7-day movement</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-teal-bright">
                {stats.rankingPoints.toLocaleString()}
              </div>
              <div className="text-[10px] text-mist">points</div>
            </div>
          </div>
          <Link
            href="/rankings"
            className="mt-4 inline-block text-xs font-medium text-teal"
          >
            Full leaderboard →
          </Link>
        </Card>

        {/* performance */}
        <Card title="Performance" span={1}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini k="Played" v={stats.matchesPlayed} />
            <Mini k="Won" v={stats.wins} accent />
            <Mini k="Lost" v={stats.losses} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-mist">Win rate</span>
            <span className="font-display text-lg font-bold text-white">
              {stats.winPct}%
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-mist">Form</span>
            <FormDots form={stats.recentForm} />
          </div>
        </Card>

        {/* next up */}
        <Card title="Next up" span={1}>
          {nextMatch ? (
            <>
              <div className="text-[11px] text-mist">
                {nextMatch.round ?? nextMatch.type}
                {nextMatch.tournamentName ? ` · ${nextMatch.tournamentName}` : ""}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-mist">vs</span>
                {(() => {
                  const opp =
                    nextMatch.playerA.id === profile.id
                      ? nextMatch.playerB
                      : nextMatch.playerA;
                  return (
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
                  );
                })()}
              </div>
              <div className="mt-2 text-[12px] text-teal">
                {formatDayTime(nextMatch.scheduledAt)} · {nextMatch.tableName}
              </div>
            </>
          ) : (
            <div className="text-sm text-mist">
              No scheduled match.{" "}
              <Link href="/players" className="text-teal">
                Find an opponent →
              </Link>
            </div>
          )}
        </Card>

        {/* profile completion */}
        <Card title="Profile completion" span={1}>
          <div className="flex items-center gap-4">
            <RadialProgress value={completion} />
            <div className="text-[13px] text-mist">
              {completion >= 100
                ? "All set — your profile is complete."
                : "Add a bio, home table and play a few ranked frames to complete your profile."}
            </div>
          </div>
        </Card>

        {/* loyalty */}
        <Card title="Loyalty" span={1} id="loyalty">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-3xl font-bold text-white">
                {profile.loyaltyPoints.toLocaleString()}
              </div>
              <div className="text-[10px] text-mist">
                available · {lifetime.toLocaleString()} lifetime
              </div>
            </div>
            <span className="rounded-full bg-teal/12 px-2 py-1 text-[10px] font-semibold text-teal">
              {membershipPlan?.loyaltyMultiplier ?? 1}× earning
            </span>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-mist">
              <span>Next reward at {nextRewardAt.toLocaleString()}</span>
              <span>{progress}%</span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="block h-full rounded-full bg-gradient-to-r from-teal-deep to-teal"
              />
            </span>
          </div>
          <Link
            href="/membership"
            className="mt-3 inline-block text-xs font-medium text-teal"
          >
            Browse rewards →
          </Link>
        </Card>

        {/* membership */}
        <Card title="Membership" span={1}>
          {membershipPlan ? (
            <>
              <div className="flex items-center justify-between">
                <MembershipBadge tier={profile.membershipTier} />
                <span className="text-[11px] text-mist">
                  {profile.membershipExpiry
                    ? `Renews ${formatDateShort(profile.membershipExpiry)}`
                    : "Active"}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-white">{membershipPlan.name}</p>
              <ul className="mt-2 space-y-1">
                {membershipPlan.benefits.slice(0, 2).map((b) => (
                  <li key={b} className="flex gap-2 text-[12px] text-mist">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-teal" />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/membership"
                className="mt-3 inline-block text-xs font-medium text-teal"
              >
                Manage membership →
              </Link>
            </>
          ) : (
            <p className="text-sm text-mist">No active membership.</p>
          )}
        </Card>
      </div>

      {/* quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Book a table", href: "/book" },
          { label: "View rankings", href: "/rankings" },
          { label: "Browse tournaments", href: "/tournaments" },
          { label: "Match history", href: `/matches?player=${profile.slug}` },
          { label: "Edit profile", href: `/players/${profile.slug}` },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white transition-all hover:-translate-y-0.5 hover:border-teal/30"
          >
            {a.label}
            <span className="text-teal transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ))}
      </div>

      {/* activity + tournaments */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.28em] text-teal">
              Recent activity
            </h2>
            <Link
              href={`/matches?player=${profile.slug}`}
              className="text-xs text-mist hover:text-white"
            >
              All matches →
            </Link>
          </div>
          <div className="space-y-3">
            {recentMatches.slice(0, 6).map((m, i) => (
              <MatchCard key={m.id} m={m} perspective={profile.id} delay={i * 0.03} />
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
              Your tournaments
            </h2>
            {registeredTournaments.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-mist">
                You&apos;re not registered for any tournaments.{" "}
                <Link href="/tournaments" className="text-teal">
                  Browse →
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {registeredTournaments.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/tournaments/${t.slug}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-teal/25"
                  >
                    <span className="text-sm text-white">{t.name}</span>
                    <span className="text-[11px] text-teal">
                      {new Date(t.startAt) > new Date()
                        ? formatDateShort(t.startAt)
                        : "In progress"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-teal">
              Loyalty ledger
            </h2>
            <div className="space-y-1.5">
              {loyalty.slice(0, 6).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-white">
                      {tx.reason}
                    </span>
                    <span className="text-[10px] text-mist/60">
                      {timeAgo(tx.at)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.points >= 0 ? "text-teal" : "text-rose-300",
                    )}
                  >
                    {tx.points >= 0 ? "+" : ""}
                    {tx.points}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  span,
  id,
}: {
  title: string;
  children: React.ReactNode;
  span?: number;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.025] p-5",
        span === 2 && "lg:col-span-2",
      )}
    >
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mist/60">
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Mini({
  k,
  v,
  accent,
}: {
  k: string;
  v: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-display text-lg font-bold tabular-nums",
          accent ? "text-teal-bright" : "text-white",
        )}
      >
        {v}
      </div>
      <div className="text-[10px] text-mist">{k}</div>
    </div>
  );
}

function RadialProgress({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        stroke="#2af0d6"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * value) / 100 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 fill-white font-display text-[13px] font-bold"
        style={{ transformOrigin: "center" }}
      >
        {value}%
      </text>
    </svg>
  );
}
