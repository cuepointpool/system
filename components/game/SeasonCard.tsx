import Link from "next/link";
import { CampaignImage } from "./CampaignImage";
import { ChevronIcon, TrophyIcon } from "./Icons";
import { ARTWORK, SEASON } from "@/lib/campaign/content";

/** The season hero — the one piece of marketing inside the game shell. */
export function SeasonCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href="/campaign/progress"
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-teal/25 bg-navy-900 p-3"
      >
        <CampaignImage
          src={SEASON.image}
          fallback={ARTWORK.eightBall}
          focus="60% 50%"
          alt=""
          className="absolute inset-0 opacity-40"
          imageClassName="object-cover"
          sizes="100vw"
        />
        <span className="relative min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-teal">
            Season {SEASON.number}
          </span>
          <span className="block truncate font-display text-base font-bold uppercase text-white">
            {SEASON.name}
          </span>
        </span>
        <span className="relative flex shrink-0 items-center gap-1 rounded-full bg-teal px-4 py-2 text-[12px] font-bold text-navy-950">
          View season
          <ChevronIcon className="h-3.5 w-3.5" />
        </span>
      </Link>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-teal/25 bg-navy-900">
      <CampaignImage
        src={SEASON.image}
        fallback={ARTWORK.eightBall}
        focus="62% 50%"
        alt="Season 1 — Rise of Precision"
        className="absolute inset-0"
        sizes="(max-width: 768px) 100vw, 640px"
        priority
      />
      {/* left-weighted scrim so the copy stays readable over any artwork */}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,16,28,0.96)_18%,rgba(5,16,28,0.78)_46%,rgba(5,16,28,0.25)_100%)]" />
      <div className="relative p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-teal">
          Season {SEASON.number}
        </span>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-none text-white sm:text-3xl">
          {SEASON.name}
        </h2>
        <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-mist">
          <TrophyIcon className="h-4 w-4 text-gold" />
          {SEASON.pillars.map((p, i) => (
            <li key={p} className="flex items-center gap-2 uppercase tracking-wide">
              {i > 0 && <span className="text-white/20">|</span>}
              {p}
            </li>
          ))}
        </ul>
        <Link
          href="/campaign/progress"
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-teal px-6 text-[13px] font-bold uppercase tracking-wide text-navy-950 transition-transform active:scale-95"
        >
          View season details
          <ChevronIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
