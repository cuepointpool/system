"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TESTIMONIALS } from "@/lib/config";
import { Reveal } from "./Reveal";

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-14%"]);

  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <span className="text-xs uppercase tracking-[0.35em] text-teal">Word on the floor</span>
        </Reveal>
      </div>

      <div ref={ref} className="mt-10">
        <motion.div style={{ x }} className="flex gap-5 px-5 md:px-8">
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
            <figure
              key={i}
              className="relative w-[300px] shrink-0 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-7 md:w-[420px]"
            >
              <span className="font-display text-5xl leading-none text-teal/40">&ldquo;</span>
              <blockquote className="mt-2 text-sm leading-relaxed text-white/90 md:text-base">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 text-xs text-mist">
                <span className="font-medium text-white">{t.name}</span> · {t.role}
              </figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
