import Image from "next/image";
import Link from "next/link";
import { HOURS_DISPLAY, SITE } from "@/lib/config";
import { Reveal } from "./Reveal";

const WA_NUMBER = SITE.phoneHref.replace(/\D/g, "");

const CHIPS = [
  { label: "Call", href: SITE.phoneHref, icon: "phone", external: false },
  {
    label: "WhatsApp",
    href: `https://wa.me/${WA_NUMBER}`,
    icon: "whatsapp",
    external: true,
  },
  { label: "Directions", href: SITE.address.maps, icon: "pin", external: true },
] as const;

const HIGHLIGHTS = [
  { label: "Parking available", icon: "car" },
  { label: "Easy access", icon: "route" },
  { label: "Walk-ins welcome", icon: "door" },
] as const;

const MAP_SRC =
  "https://www.openstreetmap.org/export/embed.html?bbox=79.965%2C6.815%2C80.045%2C6.875&layer=mapnik&marker=6.845%2C80.005";

export function Location() {
  return (
    <section
      id="visit"
      className="relative isolate overflow-hidden bg-navy-950 py-20 sm:py-28 md:py-32"
    >
      {/* subtle blurred 8-ball texture so the section belongs to the site */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/media/book-bg.png"
          alt=""
          fill
          sizes="100vw"
          className="scale-110 object-cover object-center opacity-[0.28] blur-[3px]"
        />
        <div className="absolute inset-0 bg-navy-950/78" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-950/45 to-navy-950" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-teal/10 blur-[120px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-14">
        {/* ================= LEFT ================= */}
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-teal">
            Find Cue Point
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-5xl">
            <span className="block">Your next game</span>
            <span className="block text-teal-gradient">starts here.</span>
          </h2>

          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-navy-900/50 px-4 py-2 text-sm font-medium text-white backdrop-blur">
            <LocIcon name="pin" className="text-teal" />
            {SITE.address.line1}, {SITE.address.line2}
          </span>

          <p className="mt-5 max-w-md text-mist">
            Easy to reach, easy to park — and hard to leave after one game.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <a
                key={c.label}
                href={c.href}
                {...(c.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs font-medium text-white transition-colors hover:border-teal/40 hover:text-teal"
              >
                <LocIcon name={c.icon} className="text-teal" />
                {c.label}
              </a>
            ))}
          </div>

          <div className="mt-8">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              <LocIcon name="clock" />
              Opening hours
            </span>
            <ul className="mt-3 space-y-2">
              {HOURS_DISPLAY.map((h) => (
                <li
                  key={h.day}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-navy-900/40 px-4 py-3 backdrop-blur"
                >
                  <span className="flex items-center gap-2.5 text-sm text-mist">
                    <LocIcon name="calendar" className="text-teal/70" />
                    {h.short}
                  </span>
                  <span className="font-display text-sm font-semibold text-white">
                    {h.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={SITE.address.maps}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-950 transition-colors hover:bg-teal-bright"
            >
              Get directions
              <span aria-hidden>&#8599;</span>
            </a>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 rounded-full border border-teal/45 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal transition-colors hover:bg-teal hover:text-navy-950"
            >
              Book a table
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </Reveal>

        {/* ================= RIGHT ================= */}
        <Reveal delay={0.1}>
          <ul className="mb-5 grid grid-cols-3 gap-3">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h.label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-navy-900/40 px-2 py-3 text-center backdrop-blur"
              >
                <span className="text-teal">
                  <LocIcon name={h.icon} />
                </span>
                <span className="text-[11px] font-medium text-white/85">
                  {h.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="relative">
            <div className="relative h-[380px] overflow-hidden rounded-[32px] border border-white/[0.06] shadow-[0_40px_120px_-50px_rgba(0,0,0,0.9),0_0_90px_-28px_rgba(0,194,168,0.4)] sm:h-[460px]">
              <iframe
                title="Map to Cue Point, Pitipana, Homagama"
                className="absolute inset-0 h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={MAP_SRC}
              />

              {/* glowing Cue Point pin (marker sits dead-centre of this bbox) */}
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute -inset-3 animate-ping rounded-full bg-teal/40" />
                <span className="relative block h-3.5 w-3.5 rounded-full bg-teal shadow-[0_0_18px_5px_rgba(0,194,168,0.65)] ring-4 ring-teal/25" />
              </span>

              <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/[0.05]" />

              <a
                href={SITE.address.maps}
                target="_blank"
                rel="noreferrer"
                className="absolute right-4 top-4 rounded-full glass-strong px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:text-teal"
              >
                Google Maps &#8599;
              </a>
            </div>

            {/* floating location card overlapping the bottom-left corner */}
            <div className="absolute -bottom-6 left-3 max-w-[16rem] rounded-2xl border border-white/[0.07] bg-navy-900/90 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md sm:-left-4">
              <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
                <LocIcon name="ball" className="text-teal" />
                {SITE.name} Pool Parlour
              </span>
              <span className="mt-1 block text-xs text-mist">
                {SITE.address.line1}, {SITE.address.line2}
              </span>
              <span className="mt-2 block text-[11px] font-medium text-teal">
                Parking available &bull; Walk-ins welcome
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function LocIcon({ name, className }: { name: string; className?: string }) {
  const p = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `shrink-0 ${className ?? ""}`,
  };
  switch (name) {
    case "pin":
      return (
        <svg {...p}>
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "phone":
      return (
        <svg {...p}>
          <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 14l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 6a2 2 0 0 1 2-3Z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...p}>
          <path d="M20 12a8 8 0 0 1-11.7 7L4 20l1.1-4.1A8 8 0 1 1 20 12Z" />
          <path d="M9 9c0 4 2 6 6 6 .7 0 1-.5 1-1l-.2-1.3-2 .6c-1.3-.5-2-1.2-2.5-2.5l.6-2L11 6c-.5 0-1 .3-1 1" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" />
        </svg>
      );
    case "car":
      return (
        <svg {...p}>
          <path d="M5 12l1.5-4A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.3L19 12M4 12h16v5a1 1 0 0 1-1 1h-2v-2H7v2H5a1 1 0 0 1-1-1z" />
          <circle cx="7.5" cy="15" r="0.6" fill="currentColor" />
          <circle cx="16.5" cy="15" r="0.6" fill="currentColor" />
        </svg>
      );
    case "route":
      return (
        <svg {...p}>
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <path d="M8 15.5c2-1 4-1 6-3s2-4 2-4" />
        </svg>
      );
    case "door":
      return (
        <svg {...p}>
          <path d="M6 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M4 21h16" />
          <circle cx="13" cy="12" r="0.7" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
