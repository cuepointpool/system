import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";

const CHIPS = [
  { label: "9ft size", icon: "ruler" },
  { label: "Premium setup", icon: "diamond" },
  { label: "VIP experience", icon: "crown" },
  { label: "Best value", icon: "rosette" },
] as const;

export function Pricing() {
  return (
    <section
      id="pricing"
      className="relative isolate overflow-hidden border-t border-white/5 bg-navy-950"
    >
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[420px] w-[620px] max-w-[130vw] rounded-full bg-teal/8 blur-[140px]" />

      {/* ---- the table: fills the entire right side of the section (desktop) ---- */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] lg:block">
        <Image
          src="/media/king-table.png"
          alt="Cue Point 9ft King Model international VIP pool table"
          fill
          priority={false}
          sizes="56vw"
          className="object-cover object-center"
        />
        {/* blend the left edge into the copy, soften top & bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/55 via-transparent to-navy-950/55" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:px-8 lg:py-24">
        <div className="lg:max-w-[47%]">
          {/* ---- left: the offer ---- */}
          <Reveal>
            <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              <span className="block text-white">VIP International</span>
              <span className="block text-teal-gradient">King Size Tables</span>
            </h2>

            <span className="mt-6 flex items-center gap-2">
              <span className="h-px w-16 bg-gradient-to-r from-teal to-transparent" />
              <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_10px_2px_rgba(0,194,168,0.6)]" />
            </span>

            <p className="mt-5 max-w-md text-[15px] italic leading-relaxed text-mist">
              All our tables are international king-size VIP tables — built for a
              top-level playing experience.
            </p>

            {/* price */}
            <div className="mt-7 max-w-md overflow-hidden rounded-2xl border border-white/[0.07] bg-navy-900/70 px-6 py-6 backdrop-blur">
              <span className="block h-px w-full bg-gradient-to-r from-transparent via-teal to-transparent" />
              <div className="flex items-end gap-3 py-4">
                <span className="pb-2 font-display text-lg font-semibold text-teal">
                  LKR
                </span>
                <span className="font-display text-6xl font-bold leading-none text-white sm:text-7xl">
                  800
                </span>
                <span className="pb-2 font-display text-lg font-semibold uppercase tracking-wide text-teal">
                  / hour
                </span>
              </div>
              <span className="block h-px w-full bg-gradient-to-r from-transparent via-teal to-transparent" />
              <p className="mt-3 text-xs text-mist">
                Every table. Standard floor or private VIP booth — one flat rate,
                no premium.
              </p>
            </div>

            {/* whole table booking */}
            <div className="mt-3 inline-flex max-w-md items-center gap-2.5 rounded-xl border border-white/[0.07] bg-navy-900/50 px-4 py-3 text-sm font-medium text-white">
              <ChipIcon name="people" />
              Whole table booking — the table is yours for the hour
            </div>

            {/* chips */}
            <ul className="mt-5 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <li
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-navy-900/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/80"
                >
                  <ChipIcon name={c.icon} />
                  {c.label}
                </li>
              ))}
            </ul>

            <Link
              href="/book"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-950 transition-colors duration-300 hover:bg-teal-bright"
            >
              Book your table
              <span aria-hidden>&rarr;</span>
            </Link>
          </Reveal>

          {/* ---- the table on mobile / tablet: full-bleed, edges feathered ---- */}
          <Reveal delay={0.1} className="-mx-5 mt-10 md:-mx-8 lg:hidden">
            <div
              className="relative aspect-[5/6] sm:aspect-[16/10]"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 7%, #000 90%, transparent)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 7%, #000 90%, transparent)",
                maskComposite: "intersect",
              }}
            >
              <Image
                src="/media/king-table.png"
                alt="Cue Point 9ft King Model international VIP pool table"
                fill
                sizes="100vw"
                className="object-cover object-center"
              />
            </div>
          </Reveal>
        </div>
      </div>

      {/* ---- bottom bar ---- */}
      <div className="border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-5 text-center md:px-8 sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="text-teal">
              <ChipIcon name="pin" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                Cue Point Pool Parlour
              </span>
              <span className="block text-xs italic text-mist">
                Where every shot feels premium.
              </span>
            </span>
          </div>

          <Image
            src="/media/logo-mark.png"
            alt=""
            width={36}
            height={36}
            className="hidden h-9 w-9 object-contain opacity-80 sm:block"
          />

          <div className="leading-tight sm:text-right">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              Book your table. Own the game.
            </span>
            <span className="block text-xs italic text-mist">
              Premium tables. Premium experience.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChipIcon({ name }: { name: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0 text-teal",
  };
  switch (name) {
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M15.5 20a5.5 5.5 0 0 1 5-5" />
        </svg>
      );
    case "ruler":
      return (
        <svg {...common}>
          <path d="M4 8h16v8H4z" />
          <path d="M8 8v3M12 8v4M16 8v3" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 3 21 9l-9 12L3 9z" />
          <path d="M3 9h18" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M3 7.5 6.5 11 12 4l5.5 7L21 7.5 19.5 19h-15L3 7.5Z" />
        </svg>
      );
    case "rosette":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
  }
}
