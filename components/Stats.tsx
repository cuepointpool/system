"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { STATS } from "@/lib/config";

export function Stats() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(0,194,168,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(0,194,168,0.6)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(60%_60%_at_50%_50%,#000,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-5 md:grid-cols-4 md:px-8">
        {STATS.map((s, i) => (
          <StatItem key={s.label} stat={s} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

function StatItem({
  stat,
  delay,
}: {
  stat: (typeof STATS)[number];
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(stat.value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * stat.value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, stat.value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="font-display text-[2.4rem] font-bold leading-none tracking-tight text-white sm:text-5xl md:text-6xl">
        {n.toLocaleString("en-LK")}
        <span className="text-teal">{stat.suffix}</span>
      </div>
      <div className="mt-3 h-px w-full bg-white/10">
        <motion.div
          className="h-px bg-teal"
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.4, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: 0 }}
        />
      </div>
      <p className="mt-3 text-sm text-mist">{stat.label}</p>
    </motion.div>
  );
}
