"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { MagneticButton } from "./MagneticButton";
import { scrollToId } from "./SmoothScroll";
import logoMark from "@/public/media/logo-mark.png";
import cover from "@/public/media/cover.png";

const HEADLINE = ["Where", "every", "shot", "counts"];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const videoScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.28]);
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const overlay = useTransform(scrollYProgress, [0, 1], [0.18, 0.9]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  // pointer parallax
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 });
  const ballX = useTransform(sx, (v) => v * 40);
  const ballY = useTransform(sy, (v) => v * 40);
  const ringX = useTransform(sx, (v) => v * -22);
  const ringY = useTransform(sy, (v) => v * -22);
  const glowX = useTransform(sx, (v) => v * 70);
  const glowY = useTransform(sy, (v) => v * 70);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <section
      id="home"
      ref={ref}
      onMouseMove={onMove}
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pt-24 sm:pt-28"
    >
      {/* still fallback behind the video */}
      <motion.div style={{ scale: videoScale, y: videoY }} className="absolute inset-0 -z-30">
        <Image
          src={cover}
          alt=""
          aria-hidden
          priority
          fill
          sizes="100vw"
          className="scale-[1.6] object-cover object-[97%_50%] brightness-110 contrast-105"
        />
      </motion.div>

      {/* video layer — fades in only once it's actually playing */}
      <motion.div
        style={{ scale: videoScale, y: videoY }}
        className="absolute inset-0 -z-20"
      >
        <video
          onPlaying={() => setVideoReady(true)}
          className={
            "h-full w-full object-cover transition-opacity duration-700 " +
            (videoReady ? "opacity-100" : "opacity-0")
          }
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
      </motion.div>

      {/* colour + vignette overlays */}
      <motion.div
        style={{ opacity: overlay }}
        className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/40 via-navy-950/10 to-navy-950/85"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_120%,rgba(0,194,168,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 shadow-[inset_0_0_160px_30px_rgba(5,16,28,0.5)]" />

      {/* floating decor */}
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="pointer-events-none absolute -left-24 top-24 -z-10 h-72 w-72 rounded-full bg-teal/20 blur-[90px]"
      />
      <motion.div
        style={{ x: ringX, y: ringY }}
        className="animate-float-slow pointer-events-none absolute right-[6%] top-[16%] hidden h-40 w-40 rounded-full border border-teal/20 md:block"
      >
        <div className="absolute inset-4 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(0,194,168,0.35),transparent_60%)]" />
      </motion.div>
      <motion.div
        style={{ x: ballX, y: ballY }}
        className="pointer-events-none absolute bottom-[12%] right-[10%] hidden w-28 md:block lg:w-36"
      >
        <Image
          src={logoMark}
          alt=""
          aria-hidden
          className="animate-float-slow drop-shadow-[0_20px_50px_rgba(0,194,168,0.4)]"
        />
      </motion.div>

      {/* content */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative mx-auto w-full max-w-6xl px-5 md:px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs tracking-wide text-mist"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
          </span>
          Now open in Pitipana, Homagama
        </motion.div>

        <h1 className="font-display text-[clamp(2.6rem,9vw,7rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white">
          {HEADLINE.map((word, i) => (
            <span key={word} className="mr-[0.25em] inline-block overflow-hidden align-bottom">
              <motion.span
                initial={{ y: "115%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 1,
                  delay: 0.15 + i * 0.09,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={
                  i === HEADLINE.length - 1
                    ? "inline-block text-teal-gradient"
                    : "inline-block"
                }
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-xl text-[15px] text-mist sm:mt-7 sm:text-base md:text-lg"
        >
          Tournament-grade tables, a neon lounge and table service — reserved in
          three taps. No calls, no waiting for a rack.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
        >
          <MagneticButton href="/book">
            Book a table
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </MagneticButton>
          <MagneticButton
            variant="ghost"
            onClick={() => scrollToId("story")}
            strength={0.25}
          >
            Take the tour
          </MagneticButton>
        </motion.div>

        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.8 } } }}
          className="mt-10 flex flex-wrap gap-2.5 sm:mt-14 sm:gap-3"
        >
          {[
            { k: "3", v: "pro tables" },
            { k: "till 2AM", v: "every night" },
            { k: "walk-ins", v: "always welcome" },
          ].map((c) => (
            <motion.li
              key={c.v}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] } },
              }}
              className="rounded-2xl glass px-4 py-3"
            >
              <span className="font-display text-lg font-semibold text-white">{c.k}</span>{" "}
              <span className="text-xs text-mist">{c.v}</span>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      {/* scroll cue */}
      <motion.button
        onClick={() => scrollToId("story")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-mist sm:flex"
        aria-label="Scroll to explore"
      >
        Scroll
        <span className="relative flex h-9 w-5 justify-center rounded-full border border-white/[0.12]">
          <motion.span
            animate={{ y: [3, 14, 3] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="mt-1 h-1.5 w-1 rounded-full bg-teal"
          />
        </span>
      </motion.button>
    </section>
  );
}
