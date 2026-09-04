"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChapterSelector } from "./ChapterSelector";
import { CampaignMap } from "./CampaignMap";
import { MissionBottomSheet } from "./MissionBottomSheet";
import { SeasonCard } from "./SeasonCard";
import { XpBar } from "./XpBar";
import { FlagIcon, LockIcon, StarIcon, TrophyIcon } from "./Icons";
import type { CampaignState, MissionView } from "@/lib/campaign/progress";

/**
 * The campaign map screen: chapter selector, chapter summary, the mission
 * path, and the mission bottom sheet. Only the selected chapter's missions
 * are rendered — the other 90 never mount.
 */
export function CampaignMapView({ initial }: { initial: CampaignState }) {
  const router = useRouter();
  const params = useSearchParams();

  const [state, setState] = useState(initial);
  const [selectedChapter, setSelectedChapter] = useState(() => {
    const q = Number(params.get("chapter"));
    return q >= 1 && q <= state.chapters.length ? q : state.summary.currentChapter;
  });
  const [openId, setOpenId] = useState<string | null>(() => params.get("mission"));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ xp: number; coins: number; boss: boolean } | null>(null);

  const chapter = state.chapters[selectedChapter - 1];
  const missions = useMemo(
    () => state.missions.filter((m) => m.chapter === selectedChapter),
    [state.missions, selectedChapter],
  );
  const open = openId ? (state.missions.find((m) => m.id === openId) ?? null) : null;

  const selectChapter = useCallback(
    (n: number) => {
      setSelectedChapter(n);
      // keep the URL shareable without a full navigation
      router.replace(`/campaign/map?chapter=${n}`, { scroll: false });
    },
    [router],
  );

  async function onObjectives(mission: MissionView, next: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/campaign/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: mission.id, objectivesDone: next }),
      });
      const data = await res.json();
      if (!res.ok) return;

      const fresh: CampaignState = await fetch("/api/campaign", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      setState(fresh);

      if (data.completed && data.xpGained > 0) {
        setToast({ xp: data.xpGained, coins: data.coinsGained, boss: mission.isBoss });
        setTimeout(() => setToast(null), 2600);
        setOpenId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ChapterSelector
        chapters={state.chapters}
        selected={selectedChapter}
        onSelect={selectChapter}
      />

      <section>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: chapter.accent }}
        >
          Chapter {chapter.number}
        </span>
        <h2 className="mt-0.5 font-display text-2xl font-bold uppercase leading-none text-white">
          {chapter.name}
        </h2>
        <p className="mt-2 max-w-md text-[13px] leading-snug text-mist">{chapter.tagline}</p>

        {chapter.locked ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] text-mist">
            <LockIcon className="h-4 w-4 shrink-0 text-mist/70" />
            Finish the Chapter {chapter.number - 1} boss to unlock this chapter.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
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
          </>
        )}

        <dl className="mt-3 grid max-w-sm grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-navy-900/60 p-3 text-center">
          <Stat
            icon={<StarIcon className="h-4 w-4 text-gold" />}
            value={`${chapter.starsEarned} / ${chapter.starsTotal}`}
            label="Stars"
          />
          <Stat
            icon={<FlagIcon className="h-4 w-4 text-teal" />}
            value={`${chapter.missionsCompleted} / ${chapter.missionsTotal}`}
            label="Missions"
          />
          <Stat
            icon={<TrophyIcon className="h-4 w-4 text-gold" />}
            value={chapter.bossCompleted ? "1 / 1" : "0 / 1"}
            label="Chapter boss"
          />
        </dl>
      </section>

      <CampaignMap
        chapter={chapter}
        missions={missions}
        onSelect={(m) => setOpenId(m.id)}
      />

      <SeasonCard compact />

      <MissionBottomSheet
        mission={open}
        busy={busy}
        onClose={() => setOpenId(null)}
        onObjectives={onObjectives}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -12, x: "-50%" }}
            className="fixed left-1/2 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[60] flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-bold shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            style={{
              borderColor: toast.boss ? "var(--color-gold)" : "var(--color-teal)",
              background: "var(--color-navy-900)",
              color: toast.boss ? "var(--color-gold-bright)" : "var(--color-teal-bright)",
            }}
          >
            {toast.boss ? "Chapter complete!" : "Mission complete!"} +{toast.xp} XP · +
            {toast.coins.toLocaleString()} coins
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <div>
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
