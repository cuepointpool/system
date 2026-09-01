"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MatchCard } from "./MatchCard";
import { PlayerAvatar, Tabs } from "./Primitives";
import { cn, formatDateShort } from "@/lib/utils";
import type { MatchType, MatchView, PlayerLite } from "@/lib/ecosystem/types";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "ranked", label: "Ranked" },
  { value: "tournament", label: "Tournament" },
  { value: "casual", label: "Casual" },
];
const RANGE_TABS = [
  { value: "all", label: "All time" },
  { value: "30", label: "30 days" },
  { value: "7", label: "7 days" },
];

export function MatchHistory({
  initial,
  focusPlayer = null,
}: {
  initial: MatchView[];
  focusPlayer?: PlayerLite | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<MatchType | "all">("all");
  const [range, setRange] = useState("all");
  const [result, setResult] = useState<"all" | "W" | "L">("all");
  const [matches, setMatches] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "80" });
    if (type !== "all") params.set("type", type);
    if (focusPlayer) params.set("player", focusPlayer.slug);
    if (focusPlayer && result !== "all") params.set("result", result);
    if (range !== "all") {
      const from = new Date(
        Date.now() - Number(range) * 86_400_000,
      ).toISOString();
      params.set("from", from);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/matches?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMatches(d.matches))
      .finally(() => setLoading(false));
  }, [type, range, result, focusPlayer]);

  const grouped = useMemo(() => {
    const g: Record<string, MatchView[]> = {};
    for (const m of matches) {
      const key = new Date(m.playedAt).toDateString();
      (g[key] ??= []).push(m);
    }
    return Object.entries(g);
  }, [matches]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            tabs={TYPE_TABS}
            value={type}
            onChange={(v) => setType(v as MatchType | "all")}
            size="sm"
            layoutId="mh-type"
          />
          <Tabs
            tabs={RANGE_TABS}
            value={range}
            onChange={setRange}
            size="sm"
            layoutId="mh-range"
          />
        </div>
        {focusPlayer && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 py-1 pl-1 pr-3 text-xs text-teal">
              <PlayerAvatar name={focusPlayer.fullName} src={focusPlayer.avatar} size="xs" />
              {focusPlayer.nickname}
              <button
                onClick={() => router.push("/matches")}
                className="ml-0.5 text-teal/70 hover:text-white"
                aria-label="Clear player filter"
              >
                ✕
              </button>
            </span>
            <Tabs
              tabs={[
                { value: "all", label: "All" },
                { value: "W", label: "Wins" },
                { value: "L", label: "Losses" },
              ]}
              value={result}
              onChange={(v) => setResult(v as "all" | "W" | "L")}
              size="sm"
              layoutId="mh-result"
            />
          </div>
        )}
      </div>

      <div className={cn("mt-8 transition-opacity", loading && "opacity-50")}>
        {grouped.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-mist">
            No matches match those filters.
          </p>
        )}
        {grouped.map(([day, list], gi) => (
          <div key={day} className="relative">
            <div className="sticky top-20 z-10 -mx-1 mb-3 flex items-center gap-3 bg-navy-950/80 px-1 py-1.5 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-teal" />
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-mist">
                {formatDateShort(list[0].playedAt)}
              </span>
              <span className="text-[11px] text-mist/50">
                {list.length} {list.length === 1 ? "frame" : "frames"}
              </span>
              <span className="h-px flex-1 bg-white/8" />
            </div>
            <div className="ml-1 border-l border-white/8 pl-4">
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((m, i) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    perspective={focusPlayer?.id}
                    delay={i * 0.02}
                  />
                ))}
              </div>
            </div>
            {gi < grouped.length - 1 && <div className="h-6" />}
          </div>
        ))}
      </div>

      {matches.length >= 80 && (
        <p className="mt-8 text-center text-xs text-mist/60">
          Showing the 80 most recent frames.{" "}
          <Link href="/rankings" className="text-teal">
            See the rankings
          </Link>{" "}
          for career totals.
        </p>
      )}
    </div>
  );
}
