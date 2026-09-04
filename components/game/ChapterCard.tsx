import Link from "next/link";
import { CampaignImage } from "./CampaignImage";
import { XpBar } from "./XpBar";
import { ChevronIcon, FlagIcon, StarIcon, TrophyIcon } from "./Icons";
import type { ChapterView } from "@/lib/campaign/progress";

/** The "where you are right now" card on the campaign home. */
export function ChapterCard({ chapter }: { chapter: ChapterView }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-navy-900/70">
      <div className="relative">
        <CampaignImage
          src={chapter.image}
          fallback={chapter.artwork}
          focus={chapter.focus}
          alt={chapter.name}
          className="absolute inset-0"
          sizes="(max-width: 768px) 100vw, 640px"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,16,28,0.97)_20%,rgba(5,16,28,0.7)_60%,rgba(5,16,28,0.35)_100%)]" />
        <div className="relative p-5">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: chapter.accent }}
          >
            Chapter {chapter.number}
          </span>
          <h3 className="mt-0.5 font-display text-2xl font-bold uppercase leading-none text-white">
            {chapter.name}
          </h3>
          <p className="mt-2 max-w-[19rem] text-[13px] leading-snug text-mist">
            {chapter.tagline}
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-xl font-bold text-teal">
              {chapter.percent}%
            </span>
            <span className="text-[12px] text-mist">Complete</span>
          </div>
          <XpBar
            value={chapter.missionsCompleted}
            max={chapter.missionsTotal}
            className="mt-2 max-w-sm"
            height={8}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 p-3.5">
        <dl className="flex flex-1 items-center justify-between gap-1 text-center">
          <Stat
            icon={<StarIcon className="h-4 w-4 text-gold" />}
            value={`${chapter.starsEarned} / ${chapter.starsTotal}`}
            label="Stars"
          />
          <span className="h-8 w-px bg-white/10" />
          <Stat
            icon={<FlagIcon className="h-4 w-4 text-teal" />}
            value={`${chapter.missionsCompleted} / ${chapter.missionsTotal}`}
            label="Missions"
          />
          <span className="h-8 w-px bg-white/10" />
          <Stat
            icon={<TrophyIcon className="h-4 w-4 text-gold" />}
            value={chapter.bossCompleted ? "1 / 1" : "0 / 1"}
            label="Boss"
          />
        </dl>
      </div>

      <div className="px-3.5 pb-3.5">
        <Link
          href={`/campaign/map?chapter=${chapter.number}`}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-teal text-[14px] font-bold uppercase tracking-wide text-navy-950 transition-transform active:scale-[0.98]"
        >
          Continue
          <ChevronIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex-1">
      <dd className="flex items-center justify-center gap-1.5">
        {icon}
        <span className="font-display text-[13px] font-bold tabular-nums text-white">
          {value}
        </span>
      </dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wider text-mist/70">{label}</dt>
    </div>
  );
}
