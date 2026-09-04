"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Progress bar that fills on mount. Animates width only — GPU friendly. */
export function XpBar({
  value,
  max,
  className,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  className?: string;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span
      className={cn("block overflow-hidden rounded-full bg-white/10", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="block h-full rounded-full"
        style={{
          background:
            color ?? "linear-gradient(90deg, var(--color-teal-deep), var(--color-teal-bright))",
        }}
      />
    </span>
  );
}
