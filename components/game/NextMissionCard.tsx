import Link from "next/link";
import { CampaignImage } from "./CampaignImage";
import { Stars } from "./MissionCard";
import { ChevronIcon, CrownIcon } from "./Icons";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from "@/lib/campaign/content";
import type { MissionView } from "@/lib/campaign/progress";

/**
 * The hero treatment for the one mission the player can actually play next.
 * Bigger and more cinematic than a list card, because on the campaign home
 * this is the call to action the whole screen is built around.
 */
export function NextMissionCard({ mission }: { mission: MissionView }) {
  const href = `/campaign/map?chapter=${mission.chapter}&mission=${mission.id}`;

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-3xl border border-teal/30"
    >
      <div className="relative h-[190px] sm:h-[220px]">
        <CampaignImage
          src={mission.image}
          fallback={mission.artwork}
          focus={mission.focus}
          alt={mission.title}
          className="absolute inset-0 h-full w-full"
          sizes="(max-width: 768px) 100vw, 640px"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.25)_0%,rgba(5,16,28,0.7)_55%,rgba(5,16,28,0.97)_100%)]" />

        {/* corner chip */}
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-teal/40 bg-navy-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal backdrop-blur-sm">
          {mission.isBoss && <CrownIcon className="h-3.5 w-3.5 text-gold" />}
          Next mission
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-navy-950/80 px-2.5 py-1 font-display text-[12px] font-bold tabular-nums text-white backdrop-blur-sm">
          {String(mission.number).padStart(2, "0")}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-2xl font-bold uppercase leading-none text-white">
            {mission.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 max-w-[24rem] text-[12px] leading-snug text-mist">
            {mission.summary}
          </p>

          <div className="mt-3 flex items-center gap-2.5">
            <span
              className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{
                color: DIFFICULTY_COLOR[mission.difficulty],
                backgroundColor: `${DIFFICULTY_COLOR[mission.difficulty]}1f`,
              }}
            >
              {DIFFICULTY_LABEL[mission.difficulty]}
            </span>
            <span className="text-[12px] font-bold text-teal">+{mission.xp} XP</span>
            <Stars earned={mission.stars} size="h-3.5 w-3.5" />
            <span className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-teal text-navy-950">
              <ChevronIcon className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
