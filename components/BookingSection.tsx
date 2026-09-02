"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { BookingWidget, type TableOption } from "./BookingWidget";
import { BookingOpenNote } from "./BookingOpenNote";
import { Reveal } from "./Reveal";

export function BookingSection({ tables = [] }: { tables?: TableOption[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const glowY = useTransform(scrollYProgress, [0, 1], ["-10%", "20%"]);
  const headX = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  return (
    <section id="reserve" ref={ref} className="relative overflow-hidden py-20 sm:py-28 md:py-36">
      <motion.div
        style={{ y: glowY }}
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-full bg-teal/10 blur-[130px]"
      />
      <motion.h2
        style={{ x: headX }}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-2 hidden text-center font-display text-[18vw] font-bold leading-none text-stroke sm:block"
      >
        RESERVE
      </motion.h2>

      <div className="relative mx-auto max-w-5xl px-5 md:px-8">
        <Reveal className="mb-10 text-center">
          <span className="text-xs uppercase tracking-[0.35em] text-teal">See the floor, tap a slot</span>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl">
            Your table, <span className="text-teal-gradient">waiting for you</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mist">
            Live availability, instant confirmation, a reference to show at the counter.
          </p>
          <BookingOpenNote tables={tables} />
        </Reveal>

        <Reveal delay={0.1}>
          <BookingWidget tables={tables} />
        </Reveal>
      </div>
    </section>
  );
}
