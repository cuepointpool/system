import Link from "next/link";
import { cn } from "@/lib/utils";
import { CampaignImage } from "./CampaignImage";
import { XpBar } from "./XpBar";
import { ChevronIcon, CrownIcon, LockIcon, StarIcon } from "./Icons";
import type { CampaignSummary, ChapterView } from "@/lib/campaign/progress";

/** Season-level progress plus a card per chapter. */
export function CampaignProgress({
  summary,
  chapters,
}: {
  summary: CampaignSummary;
  chapters: ChapterView[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-teal/25 bg-navy-900/70 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-teal">
            Campaign completion
          </h2>
          <span className="font-display text-2xl font-bold text-white">
            {summary.percent}%
          </span>
        </div>
        <XpBar
          value={summary.missionsCompleted}
          max={summary.missionsTotal}
          className="mt-3"
          height={10}
        />
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Metric
            value={`${summary.missionsCompleted} / ${summary.missionsTotal}`}
            label="Missions"
          />
          <Metric
            value={`${summary.starsEarned} / ${summary.starsTotal}`}
            label="Stars"
            gold
          />
          <Metric value={summary.xp.toLocaleString()} label="XP earned" />
        </dl>
      </section>

      <section className="space-y-2.5">
        <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-white">
          Chapters
        </h3>
        {chapters.map((c) => (
          <ChapterRow key={c.number} chapter={c} />
        ))}
      </section>
    </div>
  );
}

function ChapterRow({ chapter }: { chapter: ChapterView }) {
  const complete = chapter.missionsCompleted === chapter.missionsTotal;
  const body = (
    <>
      <CampaignImage
        src={chapter.image}
        fallback={chapter.artwork}
        focus={chapter.focus}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full rounded-2xl",
          chapter.locked ? "opacity-15" : "opacity-30",
        )}
        sizes="(max-width: 768px) 100vw, 640px"
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(100deg, var(--color-navy-950) 30%, rgba(5,16,28,0.72) 70%, ${chapter.accent}22 100%)`,
        }}
      />
      <div className="relative flex items-center gap-2">
        <span
          className="font-display text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: chapter.locked ? undefined : chapter.accent }}
        >
          Ch {chapter.number}
        </span>
        {chapter.locked && <LockIcon className="h-3.5 w-3.5 text-mist/60" />}
        {complete && <CrownIcon className="h-4 w-4 text-gold" />}
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white">
          {chapter.name}
        </span>
        {!chapter.locked && <ChevronIcon className="h-4 w-4 shrink-0 text-teal" />}
      </div>
      <div className="relative mt-2 flex items-center gap-3">
        <XpBar
          value={chapter.missionsCompleted}
          max={chapter.missionsTotal}
          className="flex-1"
          color={`linear-gradient(90deg, ${chapter.accent}88, ${chapter.accent})`}
        />
        <span className="shrink-0 text-[11px] tabular-nums text-mist">
          {chapter.missionsCompleted}/{chapter.missionsTotal}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-gold">
          <StarIcon className="h-3.5 w-3.5" />
          {chapter.starsEarned}
        </span>
      </div>
    </>
  );

  const className = cn(
    "relative block overflow-hidden rounded-2xl border px-3.5 py-3",
    chapter.locked
      ? "border-white/8 bg-white/[0.02] opacity-70"
      : "border-white/10 bg-navy-900/70 active:bg-white/[0.05]",
  );

  if (chapter.locked) return <div className={className}>{body}</div>;
  return (
    <Link href={`/campaign/map?chapter=${chapter.number}`} className={className}>
      {body}
    </Link>
  );
}

function Metric({
  value,
  label,
  gold,
}: {
  value: string;
  label: string;
  gold?: boolean;
}) {
  return (
    <div>
      <dd
        className={cn(
          "font-display text-lg font-bold tabular-nums",
          gold ? "text-gold" : "text-white",
        )}
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wider text-mist/70">{label}</dt>
    </div>
  );
}
