"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CampaignImage } from "./CampaignImage";
import { ObjectiveList } from "./ObjectiveList";
import { RewardGrid } from "./RewardGrid";
import { RivalCard } from "./RivalCard";
import { Stars } from "./MissionCard";
import { CrownIcon } from "./Icons";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from "@/lib/campaign/content";
import type { MissionView } from "@/lib/campaign/progress";

/**
 * Mission detail as a bottom sheet: hero, objectives, rewards, rival, and a
 * sticky primary action pinned above the home indicator so the CTA is always
 * in thumb reach no matter how long the content runs.
 */
export function MissionBottomSheet({
  mission,
  onClose,
  onObjectives,
  busy,
}: {
  mission: MissionView | null;
  onClose: () => void;
  onObjectives: (m: MissionView, next: number) => void;
  busy: boolean;
}) {
  // lock the page behind the sheet while it's open
  useEffect(() => {
    if (!mission) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mission]);

  return (
    <AnimatePresence>
      {mission && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm"
        >
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl border-t border-white/12 bg-navy-950 lg:mx-auto lg:max-w-lg lg:rounded-b-3xl"
          >
            <SheetBody mission={mission} onObjectives={onObjectives} busy={busy} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetBody({
  mission,
  onObjectives,
  busy,
}: {
  mission: MissionView;
  onObjectives: (m: MissionView, next: number) => void;
  busy: boolean;
}) {
  const [started, setStarted] = useState(mission.objectivesDone > 0);
  const total = mission.objectives.length;
  const done = mission.objectivesDone;
  const complete = mission.state === "completed";
  const tracking = started || done > 0 || complete;

  return (
    <>
      {/* grab handle */}
      <div className="flex justify-center py-2.5">
        <span className="h-1 w-10 rounded-full bg-white/25" />
      </div>

      <div className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {/* hero */}
        <div className="relative -mx-4 mb-4 h-40 sm:h-48">
          <CampaignImage
            src={mission.image}
            fallback={mission.artwork}
            focus={mission.focus}
            alt={mission.title}
            className="absolute inset-0 h-full w-full"
            sizes="(max-width: 1024px) 100vw, 512px"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.25)_0%,rgba(5,16,28,0.72)_55%,var(--color-navy-950)_100%)]" />
          <div className="absolute inset-x-4 bottom-3">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal">
              {mission.isBoss && <CrownIcon className="h-4 w-4 text-gold" />}
              {mission.isBoss ? "Chapter boss · " : ""}Mission {String(mission.number).padStart(2, "0")}
            </span>
            <h2 className="mt-0.5 font-display text-2xl font-bold uppercase leading-none text-white">
              {mission.title}
            </h2>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-mist">{mission.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className="rounded-lg border px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide"
            style={{
              color: DIFFICULTY_COLOR[mission.difficulty],
              borderColor: `${DIFFICULTY_COLOR[mission.difficulty]}55`,
              backgroundColor: `${DIFFICULTY_COLOR[mission.difficulty]}14`,
            }}
          >
            {DIFFICULTY_LABEL[mission.difficulty]}
          </span>
          <span className="text-[13px] font-bold text-teal">+{mission.xp} XP</span>
          <Stars earned={mission.stars} size="h-4 w-4" className="ml-auto" />
        </div>

        {/* objectives */}
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-teal">
              Objectives
            </h3>
            <span className="text-[12px] text-mist">
              <span className="font-bold text-teal">
                {done} / {total}
              </span>{" "}
              Completed
            </span>
          </div>
          <ObjectiveList
            objectives={mission.objectives}
            done={done}
            disabled={busy || !tracking}
            onChange={tracking ? (next) => onObjectives(mission, next) : undefined}
          />
          {!tracking && (
            <p className="mt-2.5 text-center text-[11px] text-mist/60">
              Start the mission to tick objectives off as you play.
            </p>
          )}
        </section>

        {/* rewards */}
        <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-teal">
              Rewards
            </h3>
            <span className="text-[11px] text-mist">
              {complete ? "Earned" : "Complete this mission to earn"}
            </span>
          </div>
          <RewardGrid rewards={mission.rewards} earned={complete} />
        </section>

        {mission.rival && (
          <div className="mt-3">
            <RivalCard rival={mission.rival} />
          </div>
        )}
      </div>

      {/* sticky action */}
      <div className="border-t border-white/10 bg-navy-950/95 px-4 pb-safe pt-3">
        <div className="pb-3">
          {complete ? (
            <div className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-teal/40 bg-teal/10 text-[14px] font-bold uppercase tracking-wide text-teal">
              Mission complete
              <Stars earned={mission.stars} size="h-4 w-4" />
            </div>
          ) : !tracking ? (
            <button
              onClick={() => setStarted(true)}
              disabled={busy}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-teal text-[15px] font-bold uppercase tracking-wide text-navy-950 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              Start mission
              <span aria-hidden>→</span>
            </button>
          ) : (
            <button
              onClick={() => onObjectives(mission, total)}
              disabled={busy || done >= total}
              className={cn(
                "flex min-h-[52px] w-full items-center justify-center rounded-full text-[15px] font-bold uppercase tracking-wide transition-transform active:scale-[0.98]",
                done >= total
                  ? "bg-teal/20 text-teal"
                  : "bg-teal text-navy-950 disabled:opacity-60",
              )}
            >
              {busy ? "Saving…" : `Complete mission (${done}/${total})`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
