"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckIcon, CrownIcon, LockIcon } from "./Icons";
import { Stars } from "./MissionCard";
import type { MissionView } from "@/lib/campaign/progress";

/**
 * One node on the campaign path. Tap target is 64px (68px for a boss) —
 * comfortably over the 44px minimum, with the stars sitting outside the
 * circle so they never eat into it.
 */
export function MissionNode({
  mission,
  accent,
  onSelect,
}: {
  mission: MissionView;
  accent: string;
  onSelect: (m: MissionView) => void;
}) {
  const { state, isBoss } = mission;
  const locked = state === "locked";
  const current = state === "current";
  const done = state === "completed";

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {isBoss && (
        <CrownIcon
          className={cn(
            "h-6 w-6 drop-shadow-[0_2px_6px_rgba(244,196,48,0.5)]",
            locked ? "text-gold/40" : "text-gold",
          )}
        />
      )}

      <button
        type="button"
        onClick={() => !locked && onSelect(mission)}
        disabled={locked}
        aria-label={`Mission ${mission.number}: ${mission.title}${locked ? " (locked)" : ""}`}
        className={cn(
          "relative grid place-items-center rounded-full font-display font-bold tabular-nums transition-transform",
          isBoss ? "h-[68px] w-[68px] text-xl" : "h-16 w-16 text-lg",
          locked && "cursor-not-allowed bg-navy-900/90 text-mist/40 ring-1 ring-white/10",
          done && "bg-navy-950/80 text-white active:scale-95",
          current && "bg-navy-950 text-white active:scale-95",
        )}
        style={
          locked
            ? undefined
            : {
                boxShadow: isBoss
                  ? "0 0 0 3px var(--color-gold), 0 0 26px -2px rgba(244,196,48,0.75)"
                  : current
                    ? `0 0 0 3px ${accent}, 0 0 30px -2px ${accent}`
                    : `0 0 0 2px ${accent}`,
              }
        }
      >
        {/* pulse ring on the one mission you can actually play */}
        {current && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 2px ${accent}` }}
            animate={{ scale: [1, 1.28, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {locked ? (
          <LockIcon className="h-5 w-5" />
        ) : done ? (
          <span className="flex flex-col items-center leading-none">
            <CheckIcon className="h-5 w-5 text-teal" />
          </span>
        ) : (
          String(mission.number).padStart(2, "0")
        )}
      </button>

      {!locked && <Stars earned={mission.stars} size="h-3.5 w-3.5" />}
    </div>
  );
}
