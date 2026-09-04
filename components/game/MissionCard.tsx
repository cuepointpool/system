"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CampaignImage } from "./CampaignImage";
import { ChevronIcon, CrownIcon, LockIcon, StarIcon } from "./Icons";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, STARS_PER_MISSION } from "@/lib/campaign/content";
import type { MissionView } from "@/lib/campaign/progress";

/**
 * Horizontal mission card — thumbnail, number, name, difficulty, XP, stars.
 * Deliberately no description: the detail sheet carries that.
 */
export function MissionCard({
  mission,
  onSelect,
  href,
  label,
}: {
  mission: MissionView;
  onSelect?: (m: MissionView) => void;
  /** render as a link instead of a button (used on the campaign home) */
  href?: string;
  label?: string;
}) {
  const locked = mission.state === "locked";
  const className = cn(
    "flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border text-left transition-transform",
    locked
      ? "cursor-not-allowed border-white/8 bg-white/[0.02] opacity-60"
      : "border-white/10 bg-navy-900/70 active:scale-[0.99]",
    mission.isBoss && !locked && "border-gold/40",
  );

  const body = (
    <>
      <span className="relative aspect-video w-[38%] shrink-0 max-w-[150px]">
        <CampaignImage
          src={mission.image}
          fallback={mission.artwork}
          focus={mission.focus}
          alt=""
          className="absolute inset-0 h-full w-full"
          sizes="150px"
        />
        {locked && (
          <span className="absolute inset-0 grid place-items-center bg-navy-950/70">
            <LockIcon className="h-5 w-5 text-mist/70" />
          </span>
        )}
        {mission.isBoss && (
          <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-navy-950/80 text-gold">
            <CrownIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3.5 py-3">
        <span className="flex items-center gap-2">
          <span className="font-display text-[11px] font-bold tabular-nums text-mist/70">
            {String(mission.number).padStart(2, "0")}
          </span>
          {label && (
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal">
              {label}
            </span>
          )}
        </span>
        <span className="truncate font-display text-[15px] font-bold text-white">
          {mission.title}
        </span>
        <span className="flex items-center gap-2.5 text-[11px]">
          <span
            className="font-bold uppercase tracking-wide"
            style={{ color: DIFFICULTY_COLOR[mission.difficulty] }}
          >
            {DIFFICULTY_LABEL[mission.difficulty]}
          </span>
          <span className="text-white/20">|</span>
          <span className="font-semibold text-teal">+{mission.xp} XP</span>
          <Stars earned={mission.stars} />
        </span>
      </span>

      {!locked && (
        <span className="grid w-9 shrink-0 place-items-center text-teal">
          <ChevronIcon className="h-4 w-4" />
        </span>
      )}
    </>
  );

  if (href && !locked) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onSelect?.(mission)}
      className={className}
    >
      {body}
    </button>
  );
}

export function Stars({
  earned,
  size = "h-3 w-3",
  className,
}: {
  earned: number;
  /** tailwind size classes, e.g. "h-4 w-4" */
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${earned} of ${STARS_PER_MISSION} stars`}
    >
      {Array.from({ length: STARS_PER_MISSION }, (_, i) => (
        <StarIcon
          key={i}
          filled={i < earned}
          className={cn(size, i < earned ? "text-gold" : "text-white/25")}
        />
      ))}
    </span>
  );
}
