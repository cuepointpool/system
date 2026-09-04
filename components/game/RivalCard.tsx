"use client";

import { CampaignImage } from "./CampaignImage";
import { ChevronIcon } from "./Icons";
import { ARTWORK, type Rival } from "@/lib/campaign/content";

/**
 * The opponent standing between you and the next chapter.
 *
 * Rival portraits are the one asset with no sensible stand-in — none of the
 * shipped artwork has a person in it — so until `rival-<slug>.png` lands this
 * shows a lit silhouette plate over the moody table shot rather than a
 * stretched photo of a pool table pretending to be a face.
 */
export function RivalCard({ rival }: { rival: Rival }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy-900/70">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-white">
          Next rival
        </h3>
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-teal">
          View profile
          <ChevronIcon className="h-3 w-3" />
        </span>
      </div>
      <div className="flex items-stretch gap-0 border-t border-white/8">
        <div className="relative aspect-[3/4] w-[38%] max-w-[132px] shrink-0 overflow-hidden">
          <CampaignImage
            src={rival.image}
            fallback={ARTWORK.table}
            focus="50% 45%"
            alt={rival.name}
            className="absolute inset-0 h-full w-full"
            sizes="132px"
          />
          {/* silhouette plate: reads as an unknown opponent, not a broken image */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.35),rgba(5,16,28,0.9))]" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="font-display text-4xl font-bold text-white/25">
              {rival.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3.5 py-3">
          <span className="font-display text-lg font-bold uppercase leading-none text-white">
            {rival.name}
          </span>
          <span className="text-[13px] font-semibold text-teal">Rank #{rival.rank}</span>
          <span className="text-[12px] leading-snug text-mist">{rival.blurb}</span>
        </div>
      </div>
    </section>
  );
}
