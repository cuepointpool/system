import Link from "next/link";
import { HOURS_DISPLAY, SITE } from "@/lib/config";
import { MapEmbed } from "./MapEmbed";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

const WA_NUMBER = SITE.phoneHref.replace(/\D/g, "");

const linkClass =
  "font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-gold hover:decoration-gold";

export function Location() {
  return (
    <section id="visit" className="bg-navy-950 py-20 sm:py-28">
      <div className="grid gap-12 px-5 md:px-8 lg:grid-cols-[1fr_1.25fr] lg:items-start lg:gap-16 lg:px-12">
        {/* ================= details ================= */}
        <Reveal>
          <SectionKicker>
            Find Cue Point
          </SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            {SITE.address.line1}, {SITE.address.line2}
          </h2>

          <dl className="mt-8 border-t border-white/15">
            <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
              <dt className="text-[15px] text-mist">Opening hours</dt>
              <dd className="text-right text-[15px] font-semibold text-white">
                {HOURS_DISPLAY.map((h) => (
                  <span key={h.day} className="block">
                    {h.day}, {h.time}
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
              <dt className="text-[15px] text-mist">Google Maps code</dt>
              <dd className="text-[15px]">
                <a href={SITE.address.maps} target="_blank" rel="noreferrer" className={linkClass}>
                  {SITE.address.plusCode}
                </a>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
              <dt className="text-[15px] text-mist">Phone</dt>
              <dd className="text-[15px]">
                <a href={SITE.phoneHref} className={linkClass}>
                  {SITE.phone}
                </a>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
              <dt className="text-[15px] text-mist">WhatsApp</dt>
              <dd className="text-[15px]">
                <a
                  href={`https://wa.me/${WA_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  Message us
                </a>
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={SITE.address.maps}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
            >
              Get directions
            </a>
            <Link
              href="/book"
              className="inline-flex items-center rounded-full border border-white/60 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-navy-950"
            >
              Book a table
            </Link>
          </div>
        </Reveal>

        {/* ================= map ================= */}
        <Reveal delay={0.1}>
          <div className="relative h-[360px] overflow-hidden rounded-lg bg-navy-900 sm:h-[460px]">
            <MapEmbed />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
