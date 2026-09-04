"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CampaignImage } from "./CampaignImage";
import { LockIcon } from "./Icons";
import type { ChapterView } from "@/lib/campaign/progress";

/**
 * Horizontally swipeable chapter pills. Only the selected chapter's missions
 * are ever rendered, so the map never mounts 100 nodes at once.
 */
export function ChapterSelector({
  chapters,
  selected,
  onSelect,
}: {
  chapters: ChapterView[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // keep the active chapter in view when it changes (e.g. deep link)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-chapter="${selected}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div
      ref={ref}
      className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1"
    >
      {chapters.map((c) => {
        const active = c.number === selected;
        return (
          <button
            key={c.number}
            data-chapter={c.number}
            onClick={() => onSelect(c.number)}
            className={cn(
              "relative flex min-h-[64px] w-[132px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border px-3 py-2 text-center transition-colors",
              active
                ? "border-teal bg-teal/10"
                : "border-white/10 bg-navy-900/60 active:bg-white/[0.06]",
            )}
            style={active ? { borderColor: c.accent } : undefined}
          >
            <CampaignImage
              src={c.image}
              fallback={c.artwork}
              focus={c.focus}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full",
                active ? "opacity-30" : "opacity-15",
              )}
              sizes="132px"
            />
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                background: active
                  ? `linear-gradient(180deg, rgba(5,16,28,0.55), ${c.accent}22)`
                  : "linear-gradient(180deg, rgba(5,16,28,0.72), rgba(5,16,28,0.88))",
              }}
            />
            <span
              className={cn(
                "relative font-display text-[15px] font-bold",
                active ? "text-white" : "text-mist",
              )}
              style={active ? { color: c.accent } : undefined}
            >
              CH {c.number}
            </span>
            <span
              className={cn(
                "relative flex items-center gap-1 text-[11px] leading-tight",
                active ? "text-white/90" : "text-mist/70",
              )}
            >
              {c.locked && <LockIcon className="h-3 w-3" />}
              <span className="truncate">{c.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
