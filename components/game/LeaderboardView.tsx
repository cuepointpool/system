"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CampaignImage } from "./CampaignImage";
import { LeaderboardPlayerCard, Podium } from "./LeaderboardPlayerCard";
import { ARTWORK } from "@/lib/campaign/content";
import type { LeaderboardRow, RankingScope } from "@/lib/ecosystem/types";

const SCOPES: { value: RankingScope; label: string }[] = [
  { value: "all_time", label: "All Time" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

export function LeaderboardView({
  initial,
  youId,
}: {
  initial: LeaderboardRow[];
  youId?: string;
}) {
  const [scope, setScope] = useState<RankingScope>("all_time");
  const [rows, setRows] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scope === "all_time") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(initial);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rankings?scope=${scope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setRows(d.rows))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope, initial]);

  const rest = rows.slice(3);
  const you = rows.find((r) => r.id === youId);

  return (
    <div className="space-y-4 pt-2">
      {/* scope tabs */}
      <div className="flex rounded-full border border-white/10 bg-navy-900/70 p-1">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className={cn(
              "min-h-[40px] flex-1 rounded-full text-[13px] font-semibold transition-colors",
              scope === s.value
                ? "bg-teal/15 text-teal ring-1 ring-teal/40"
                : "text-mist active:text-white",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-[13px] text-mist">
          No ranked results in this window yet. Rankings appear once staff record
          a ranked or tournament match.
        </p>
      ) : (
        <div className={cn("space-y-4 transition-opacity", loading && "opacity-40")}>
          {/* podium sits on the trophy artwork, lit from below in gold */}
          <div className="relative -mx-4 overflow-hidden px-4 pb-4 pt-2">
            <CampaignImage
              src={ARTWORK.trophy}
              focus="72% 28%"
              alt=""
              className="absolute inset-0 h-full w-full"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.78)_0%,rgba(5,16,28,0.6)_45%,var(--color-navy-950)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_85%,rgba(244,196,48,0.22),transparent_70%)]" />
            <div className="relative">
              <Podium rows={rows} youId={youId} />
            </div>
          </div>

          <ol className="space-y-2">
            {rest.map((row, i) => (
              <LeaderboardPlayerCard
                key={row.id}
                row={row}
                index={i}
                isYou={row.id === youId}
              />
            ))}
          </ol>

          {you && !rows.slice(0, 10).some((r) => r.id === youId) && (
            <div className="sticky bottom-2 z-10">
              <p className="mb-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-mist/60">
                Your position
              </p>
              <ol>
                <LeaderboardPlayerCard row={you} index={0} isYou />
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
