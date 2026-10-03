import Image from "next/image";
import Link from "next/link";
import { TABLE_HALF_HOUR_RATE, TABLE_HOURLY_RATE } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="relative isolate overflow-hidden border-t border-white/10 bg-navy-950"
    >
      {/* ---- the table: full background on mobile / tablet, right side on desktop ---- */}
      <div className="pointer-events-none absolute inset-0 lg:left-auto lg:w-[56%]">
        <Image
          src="/media/king-table.png"
          alt="Cue Point 9ft King Model international VIP pool table"
          fill
          priority={false}
          sizes="(max-width:1024px) 100vw, 56vw"
          className="object-cover object-center"
        />
        {/* mobile: darken evenly so the copy stays readable over the photo */}
        <div className="absolute inset-0 bg-navy-950/80 lg:hidden" />
        {/* desktop: blend the left edge into the copy */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-navy-950 via-navy-950/35 to-transparent lg:block" />
      </div>

      <div className="relative z-10 px-5 py-20 md:px-8 lg:px-12 lg:py-28">
        <Reveal className="lg:max-w-[46%]">
          <SectionKicker>
            Pricing
          </SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            One price for every table
          </h2>

          <p className="mt-8 flex items-baseline gap-3">
            <span className="font-display text-xl font-semibold text-gold">LKR</span>
            <span className="font-display text-7xl font-bold leading-none text-white sm:text-8xl">
              {TABLE_HOURLY_RATE.toLocaleString("en-LK")}
            </span>
            <span className="font-display text-xl font-semibold text-gold">per hour</span>
          </p>

          <ul className="mt-8 max-w-md space-y-3 border-t border-white/15 pt-6 text-[15px] leading-relaxed text-white/90">
            <li>
              The same rate on the main floor and in the private booth. No
              premium for the booth.
            </li>
            <li>
              You book the whole table. It is yours for the hour, however many
              of you are playing.
            </li>
            <li>
              Just want a quick frame? 30 minutes is LKR{" "}
              {TABLE_HALF_HOUR_RATE.toLocaleString("en-LK")}.
            </li>
          </ul>

          <Link
            href="/book"
            className="mt-8 inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
          >
            Book your table
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
