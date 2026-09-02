"use client";

import Image from "next/image";
import Link from "next/link";
import { FEATURES } from "@/lib/config";
import { Reveal } from "./Reveal";

export function Experience() {
  return (
    <section id="experience" className="relative overflow-hidden py-20 sm:py-28 md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[360px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full bg-teal/7 blur-[140px]" />

      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-teal">
            <span className="hidden h-px w-8 bg-teal/40 sm:block" />
            Why players keep coming back
            <span className="hidden h-px w-8 bg-teal/40 sm:block" />
          </span>
          <h2 className="mx-auto mt-5 max-w-4xl font-display text-4xl font-bold uppercase leading-[1.02] tracking-tight text-white md:text-[3.75rem]">
            Built for the <span className="text-teal-gradient">serious</span> and
            the <span className="text-teal-gradient">social</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mist">
            Four things we obsess over so you can just chalk up and play.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.07}>
              <FeatureCard f={f} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12}>
          <div className="mt-8 flex flex-col items-start gap-5 rounded-[22px] border border-white/[0.06] glass px-6 py-5 sm:flex-row sm:items-center sm:gap-7 sm:px-8">
            <div className="flex shrink-0 items-center gap-4">
              <Image
                src="/media/logo-mark.png"
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <span className="font-display text-lg font-bold uppercase leading-[1.05] tracking-tight">
                <span className="block text-white">Play hard.</span>
                <span className="block text-teal">Belong here.</span>
              </span>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-mist sm:border-l sm:border-white/[0.06] sm:pl-7">
              Whether you&rsquo;re chasing trophies or just good times, Cue Point
              is where the game brings us together.
            </p>
            <Link
              href="/book"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-teal px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-950 transition-colors duration-300 hover:bg-teal-bright"
            >
              Book a table
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureCard({ f }: { f: (typeof FEATURES)[number] }) {
  const [lead, ...rest] = f.title.split(" ");
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.06] bg-white/[0.02] transition-colors duration-500 hover:border-teal/35">
      <div className="relative aspect-[16/11] overflow-hidden sm:aspect-[4/5]">
        <Image
          src={f.image}
          alt={f.alt}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
      </div>

      <div className="relative -mt-7 flex items-end justify-between px-5">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-teal/30 bg-navy-900 text-teal shadow-[0_0_0_5px_rgba(5,16,28,0.9)]">
          <Icon name={f.icon} />
        </span>
        <span
          className="font-display text-[3.25rem] font-bold leading-none text-transparent"
          style={{ WebkitTextStroke: "1.5px rgba(0,194,168,0.45)" }}
          aria-hidden
        >
          {f.n}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-7 pt-4">
        <h3 className="font-display text-lg font-bold uppercase tracking-tight">
          <span className="text-teal">{lead}</span>{" "}
          <span className="text-white">{rest.join(" ")}</span>
        </h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-mist">{f.body}</p>
      </div>

      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className:
      "transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6",
  };
  switch (name) {
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 3 21 9l-9 12L3 9z" />
          <path d="M3 9h18M9 3 7 9l5 12M15 3l2 6-5 12" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
          <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4l1 4H9z" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 20a5 5 0 0 1 10 0M16 6a3 3 0 0 1 0 6M15 20a5 5 0 0 1 5-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
  }
}
