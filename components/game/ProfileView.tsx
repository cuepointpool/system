"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { CampaignImage } from "./CampaignImage";
import { XpBar } from "./XpBar";
import { Stars } from "./MissionCard";
import { BadgeIcon, ChevronIcon, StarIcon } from "./Icons";
import { ARTWORK } from "@/lib/campaign/content";
import type { CampaignState } from "@/lib/campaign/progress";
import type { Achievement, PlayerProfileView } from "@/lib/ecosystem/types";

type Tab = "overview" | "stats" | "badges" | "history";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "stats", label: "Stats" },
  { value: "badges", label: "Badges" },
  { value: "history", label: "History" },
];

export function ProfileView({
  view,
  campaign,
  allAchievements,
}: {
  view: PlayerProfileView;
  campaign: CampaignState;
  allAchievements: Achievement[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { profile, stats } = view;
  const { summary } = campaign;

  const recent = campaign.missions
    .filter((m) => m.completedAt)
    .sort((a, b) => +new Date(b.completedAt!) - +new Date(a.completedAt!))
    .slice(0, 8);

  return (
    <div className="space-y-4 pt-2">
      {/* cover + identity */}
      <section className="-mx-4 -mt-2">
        <div className="relative -mt-[calc(3.5rem+env(safe-area-inset-top,0px))] h-[220px] overflow-hidden">
          <CampaignImage
            src={ARTWORK.venue}
            focus="46% 26%"
            alt=""
            className="absolute inset-0 h-full w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.5)_0%,rgba(5,16,28,0.2)_35%,rgba(5,16,28,0.85)_78%,var(--color-navy-950)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_100%,rgba(0,194,168,0.25),transparent_70%)]" />
        </div>

        <div className="-mt-14 flex flex-col items-center px-4 text-center">
          {/* avatar with a level ring */}
          <div className="relative">
            <span className="block rounded-full bg-[conic-gradient(from_180deg,var(--color-teal-bright),var(--color-teal-deep),var(--color-teal-bright))] p-[3px]">
              <PlayerAvatar
                name={profile.fullName}
                src={profile.avatar}
                size="xl"
                className="border-4 border-navy-950"
              />
            </span>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-teal/60 bg-navy-950 px-3 py-0.5 font-display text-[11px] font-bold text-teal">
              LV {summary.level}
            </span>
          </div>

          <h2 className="mt-4 font-display text-2xl font-bold text-white">
            {profile.nickname}
          </h2>
          <p className="text-[12px] text-mist">{profile.fullName}</p>

          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist">
              {profile.skillLevel}
            </span>
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
              {profile.membershipTier}
            </span>
          </div>

          <div className="mt-4 w-full max-w-xs">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-bold text-teal">Level {summary.level}</span>
              <span className="tabular-nums text-mist">
                {summary.xpIntoLevel.toLocaleString()} / {summary.xpForLevel.toLocaleString()} XP
              </span>
            </div>
            <XpBar
              value={summary.xpIntoLevel}
              max={summary.xpForLevel}
              className="mt-1.5"
              height={8}
            />
          </div>

          <dl className="mt-5 grid w-full grid-cols-4 gap-2">
            <Metric value={stats.rank > 0 ? `#${stats.rank}` : "—"} label="Rank" />
            <Metric value={String(stats.wins)} label="Wins" />
            <Metric value={String(stats.losses)} label="Losses" />
            <Metric value={`${stats.winPct}%`} label="Win rate" />
          </dl>
        </div>
      </section>

      {/* tabs */}
      <div className="hide-scrollbar flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-navy-900/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "relative min-h-[40px] flex-1 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
              tab === t.value ? "text-navy-950" : "text-mist active:text-white",
            )}
          >
            {tab === t.value && (
              <motion.span
                layoutId="profile-tab"
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="absolute inset-0 rounded-full bg-teal"
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "overview" && (
            <div className="space-y-3">
              <Panel title="Campaign progress" art={ARTWORK.felt} focus="70% 55%">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold text-white">
                    {summary.percent}%
                  </span>
                  <span className="text-[12px] text-mist">
                    {summary.missionsCompleted} / {summary.missionsTotal} missions
                  </span>
                </div>
                <XpBar
                  value={summary.missionsCompleted}
                  max={summary.missionsTotal}
                  className="mt-2"
                  height={8}
                />
                <div className="mt-3 flex items-center gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5 text-gold">
                    <StarIcon className="h-4 w-4" />
                    {summary.starsEarned} / {summary.starsTotal} stars
                  </span>
                  <span className="text-mist">{summary.xp.toLocaleString()} XP</span>
                  <span className="text-mist">
                    {summary.coins.toLocaleString()} coins
                  </span>
                </div>
                <Link
                  href="/campaign/progress"
                  className="mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 text-[13px] font-bold uppercase tracking-wide text-teal"
                >
                  View full progress
                  <ChevronIcon className="h-3.5 w-3.5" />
                </Link>
              </Panel>

              <Panel title="Membership">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold capitalize text-white">
                    {profile.membershipTier}
                  </span>
                  <span className="text-[12px] text-mist">
                    {profile.loyaltyPoints.toLocaleString()} loyalty pts
                  </span>
                </div>
              </Panel>
            </div>
          )}

          {tab === "stats" && (
            <Panel title="Career">
              <dl className="grid grid-cols-2 gap-3">
                <Row label="Matches played" value={String(stats.matchesPlayed)} />
                <Row label="Ranked matches" value={String(stats.rankedMatches)} />
                <Row label="Rank points" value={stats.rankingPoints.toLocaleString()} />
                <Row label="Best break" value={String(stats.bestBreak)} />
                <Row label="Tournaments" value={String(stats.tournamentsPlayed)} />
                <Row label="Titles won" value={String(stats.titlesWon)} />
                <Row
                  label="Current streak"
                  value={stats.streak === 0 ? "—" : `${stats.streak > 0 ? "W" : "L"}${Math.abs(stats.streak)}`}
                />
                <Row label="Campaign level" value={String(summary.level)} />
              </dl>
            </Panel>
          )}

          {tab === "badges" && (
            <Panel title={`Badges · ${view.achievements.length} / ${allAchievements.length}`}>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {allAchievements.map((a) => {
                  const earned = view.achievements.some((x) => x.id === a.id);
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center",
                        earned
                          ? "border-teal/35 bg-teal/[0.07]"
                          : "border-white/8 bg-white/[0.02] opacity-55",
                      )}
                    >
                      <BadgeIcon
                        className={cn("h-9 w-9", !earned && "grayscale")}
                      />
                      <span className="text-[11px] font-semibold leading-tight text-white">
                        {a.name}
                      </span>
                      <span className="text-[9px] uppercase tracking-wide text-mist/60">
                        {a.tier}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {tab === "history" && (
            <Panel title="Recent missions">
              {recent.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-mist">
                  No missions completed yet.{" "}
                  <Link href="/campaign" className="text-teal underline">
                    Start the campaign
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-2 pr-3"
                    >
                      <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg">
                        <CampaignImage
                          src={m.image}
                          fallback={m.artwork}
                          focus={m.focus}
                          alt=""
                          className="absolute inset-0 h-full w-full"
                          sizes="64px"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-white">
                          {m.title}
                        </span>
                        <span className="block text-[11px] text-mist">
                          Chapter {m.chapter} · +{m.xp} XP
                        </span>
                      </span>
                      <Stars earned={m.stars} size="h-3.5 w-3.5" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Panel({
  title,
  art,
  focus,
  children,
}: {
  title: string;
  /** optional artwork behind the panel, heavily scrimmed */
  art?: string;
  focus?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy-900/70 p-4">
      {art && (
        <>
          <CampaignImage
            src={art}
            focus={focus}
            alt=""
            className="absolute inset-0 h-full w-full opacity-25"
            sizes="(max-width: 768px) 100vw, 640px"
          />
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,var(--color-navy-950)_35%,rgba(5,16,28,0.7)_100%)]" />
        </>
      )}
      <div className="relative">
        <h3 className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.16em] text-teal">
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2">
      <dd className="font-display text-[15px] font-bold tabular-nums text-white">
        {value}
      </dd>
      <dt className="text-[9px] uppercase tracking-wider text-mist/70">{label}</dt>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[11px] text-mist">{label}</dt>
      <dd className="mt-0.5 font-display text-[15px] font-bold tabular-nums text-white">
        {value}
      </dd>
    </div>
  );
}
