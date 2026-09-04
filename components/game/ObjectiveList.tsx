"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./Icons";
import type { MissionObjective } from "@/lib/campaign/content";

/**
 * Large checklist rows. Objectives complete in order — tapping row N ticks
 * everything up to N, tapping a ticked row unticks back to it, which keeps
 * the whole thing to a single "how many are done" number server-side.
 */
export function ObjectiveList({
  objectives,
  done,
  onChange,
  disabled,
}: {
  objectives: MissionObjective[];
  done: number;
  onChange?: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {objectives.map((o, i) => {
        const complete = i < done;
        const next = complete ? i : i + 1;
        return (
          <li key={o.id}>
            <button
              type="button"
              disabled={disabled || !onChange}
              onClick={() => onChange?.(next)}
              className={cn(
                "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                complete
                  ? "border-teal/40 bg-teal/[0.08]"
                  : "border-white/10 bg-white/[0.03]",
                !disabled && onChange && "active:scale-[0.99]",
              )}
            >
              <motion.span
                initial={false}
                animate={complete ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                  complete
                    ? "bg-teal text-navy-950"
                    : "border-2 border-white/25 text-transparent",
                )}
              >
                {complete && <CheckIcon className="h-4 w-4" />}
              </motion.span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-[14px]",
                  complete ? "text-white" : "text-mist",
                )}
              >
                {o.label}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[13px] font-bold tabular-nums",
                  complete ? "text-teal" : "text-mist/60",
                )}
              >
                {complete ? o.target : 0} / {o.target}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
