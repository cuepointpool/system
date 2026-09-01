"use client";

import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "framer-motion";

const WORDS = ["Play", "Compete", "Unwind", "Cue Point", "Rack 'em"];

export function Marquee({ baseVelocity = 2.4 }: { baseVelocity?: number }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smooth = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(baseX, (v) => `${wrap(-25, -50, v)}%`);
  const dir = useRef(1);
  const reduce = useReducedMotion();

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    let moveBy = dir.current * baseVelocity * (delta / 1000);
    if (factor.get() < 0) dir.current = -1;
    else if (factor.get() > 0) dir.current = 1;
    moveBy += dir.current * moveBy * factor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-navy-950/60 py-5 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-navy-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-navy-950 to-transparent" />
      <motion.div style={{ x }} className="flex whitespace-nowrap">
        {Array.from({ length: 5 }).map((_, r) => (
          <span key={r} className="flex items-center">
            {WORDS.map((w) => (
              <span key={r + w} className="flex items-center">
                <span className="mx-6 font-display text-2xl font-semibold uppercase tracking-[0.12em] text-white/90 md:text-3xl">
                  {w}
                </span>
                <span className="h-2 w-2 rounded-full bg-teal" />
              </span>
            ))}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
