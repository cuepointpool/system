"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  HOURS_DISPLAY,
  OPENING_NOTICE,
  SITE,
  TABLE_HOURLY_RATE,
} from "@/lib/config";
import { formatLKR } from "@/lib/utils";
import neonSign from "@/public/media/venue/neon-sign.jpg";

const cta =
  "inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-navy-950 transition duration-200";

export function Hero() {
  const [videoReady, setVideoReady] = useState(false);
  // The hero clip is heavy (~11 MB). Skip it on small screens and on
  // data-saver / slow connections — the still photo already carries the
  // section. Load it only after the page is interactive on desktop.
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bigScreen = window.matchMedia("(min-width: 1024px)").matches;
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const slow =
      conn?.saveData ||
      (conn?.effectiveType != null && /2g|slow/.test(conn.effectiveType));
    if (!bigScreen || slow) return;
    const load = () => setVideoSrc("/media/hero.mp4");
    const idle =
      "requestIdleCallback" in window
        ? (window.requestIdleCallback as (cb: () => void) => number)
        : (cb: () => void) => window.setTimeout(cb, 1200);
    const id = idle(load);
    return () => {
      if ("cancelIdleCallback" in window) {
        (window.cancelIdleCallback as (h: number) => void)(id as number);
      } else {
        clearTimeout(id as number);
      }
    };
  }, []);

  const hours = HOURS_DISPLAY[0];

  return (
    <section
      id="home"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pb-14 pt-28 sm:pb-20"
    >
      {/* the real sign on our wall — also the still behind the video */}
      <Image
        src={neonSign}
        alt="The Cue Point Pool Parlour neon sign"
        priority
        fill
        sizes="100vw"
        className="-z-30 object-cover object-[50%_22%]"
      />

      {/* video layer — desktop only, loads after the page is interactive,
          fades in once it's actually playing */}
      {videoSrc && (
        <video
          onPlaying={() => setVideoReady(true)}
          className={
            "absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-700 " +
            (videoReady ? "opacity-100" : "opacity-0")
          }
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* darken the bottom so the copy reads over the photo */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/10" />

      <div className="px-5 md:px-8 lg:px-12">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-teal">
          {OPENING_NOTICE.enabled ? "Opening soon" : "Now open"} ·{" "}
          {SITE.address.line1}, {SITE.address.line2}
        </p>

        <h1 className="mt-4 max-w-5xl font-display text-[clamp(2.6rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.02em] text-white">
          {SITE.tagline}
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
          Three full-size 9ft pool tables, {formatLKR(TABLE_HOURLY_RATE)} an hour
          on every one. Open {hours.time}, {hours.day.toLowerCase()}.
        </p>

        {/* the three ways in — same accent colours as the navbar pills */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href="/book" className={`${cta} bg-teal hover:bg-teal-bright`}>
            Book a table
          </Link>
          <Link
            href="/play"
            className={`${cta} bg-[linear-gradient(120deg,#a78bfa,#ec4899)] hover:brightness-110`}
          >
            Friends tournament
          </Link>
          <Link
            href="/campaign"
            className={`${cta} bg-[linear-gradient(120deg,#ffd166,#ff9d3d)] hover:brightness-110`}
          >
            Campaign mode
          </Link>
        </div>
      </div>
    </section>
  );
}
