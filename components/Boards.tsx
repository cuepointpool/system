"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";

const SPECS = [
  { label: "Solid wood\nconstruction", icon: "wood" },
  { label: "Precise\nleveling", icon: "level" },
  { label: "Silent return\nball system", icon: "return" },
  { label: "Premium rubber\ncushion", icon: "cushion" },
  { label: "Metal\ncorners", icon: "corner" },
] as const;

export function Boards() {
  return (
    <section id="boards" className="relative isolate overflow-hidden bg-navy-950">
      {/* product shot — full-bleed banner background at every screen size.
         `contain` on phones/tablets so the whole table is visible; `cover`
         on desktop where the section is tall enough to fill. */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/media/king-table.png"
          alt="Cue Point 9ft King Model international pool table"
          fill
          priority={false}
          sizes="100vw"
          className="object-contain object-[center_38%] xl:object-cover xl:object-center"
        />
        {/* readability scrim — lighter now the table is fully in frame */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/55 to-navy-950/20 xl:via-navy-950/60 xl:to-navy-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/25 to-navy-950/45 xl:via-navy-950/20 xl:to-navy-950/55" />
        <div className="absolute left-1/2 top-0 h-[45%] w-[70%] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(0,194,168,0.16),transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-[460px] max-w-6xl flex-col justify-between px-5 py-12 sm:min-h-[540px] sm:py-14 md:px-8 xl:min-h-[88vh] xl:py-24">
        <Reveal className="max-w-3xl">
          <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl xl:text-[3.75rem]">
            <span className="block text-white">9ft King Model</span>
            <span className="block text-teal-gradient">
              International Pool Tables
            </span>
          </h2>

          <span className="mt-5 flex items-center gap-2 xl:mt-6">
            <span className="h-px w-16 bg-gradient-to-r from-teal to-transparent" />
            <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_10px_2px_rgba(0,194,168,0.6)]" />
          </span>

          <p className="mt-4 text-base text-mist sm:text-lg xl:mt-5">
            Built for champions. Designed for excellence.
          </p>

          <Link
            href="/book"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-teal/45 bg-navy-950/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal backdrop-blur-sm transition-colors duration-300 hover:bg-teal hover:text-navy-950 xl:mt-7"
          >
            Book a table
            <span aria-hidden>&rarr;</span>
          </Link>
        </Reveal>

        <div className="mt-10 xl:mt-16">
          <Reveal>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-y-9 md:grid-cols-5">
              {SPECS.map((s) => (
                <li
                  key={s.label}
                  className="flex flex-col items-center gap-3 text-center md:border-l md:border-white/[0.06] md:px-4 md:first:border-l-0"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full border border-teal/35 bg-navy-950/60 text-teal backdrop-blur-sm">
                    <SpecIcon name={s.icon} />
                  </span>
                  <span className="whitespace-pre-line text-[11px] font-semibold uppercase leading-[1.35] tracking-[0.13em] text-white/85">
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="mt-8 flex items-center justify-center gap-4 xl:mt-10">
            <span className="h-px w-full max-w-[120px] bg-gradient-to-r from-transparent to-teal/40" />
            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-teal/85">
              Precision. Performance. Prestige.
            </span>
            <span className="h-px w-full max-w-[120px] bg-gradient-to-l from-transparent to-teal/40" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "wood":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="4" rx="1.5" />
          <rect x="3" y="14" width="18" height="4" rx="1.5" />
          <path d="M7 9v5M17 9v5" />
        </svg>
      );
    case "level":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "return":
      return (
        <svg {...common}>
          <circle cx="16" cy="12" r="4.5" />
          <path d="M2.5 12H8M4 8l3 1.6L4 11.2M4 16l3-1.6L4 12.8" />
        </svg>
      );
    case "cushion":
      return (
        <svg {...common}>
          <path d="M3 9h18l-2.4 4a2 2 0 0 1-1.7 1H7.1a2 2 0 0 1-1.7-1L3 9Z" />
          <path d="M3 9l2-3h14l2 3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 20V10a4 4 0 0 1 4-4h10" />
          <path d="M6 20h4M20 6v4" />
        </svg>
      );
  }
}
