import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

const SPECS = [
  "Solid wood construction",
  "Precise levelling",
  "Silent ball-return system",
  "Premium rubber cushions",
  "Metal corners",
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
        {/* readability scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/55 to-navy-950/20 xl:via-navy-950/60 xl:to-navy-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/25 to-navy-950/45 xl:via-navy-950/20 xl:to-navy-950/55" />
      </div>

      <div className="relative flex min-h-[460px] flex-col justify-between px-5 py-14 sm:min-h-[540px] md:px-8 lg:px-12 xl:min-h-[80vh] xl:py-24">
        <Reveal className="max-w-3xl">
          <SectionKicker>
            The tables
          </SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            9ft King Model international pool tables
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/85">
            Every table in the room is the same full-size 9ft model, so it does
            not matter which one you get.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
          >
            Book a table
          </Link>
        </Reveal>

        <Reveal className="mt-12">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-6 sm:grid-cols-3 lg:grid-cols-5">
            {SPECS.map((s) => (
              <li key={s} className="text-[15px] font-semibold text-white">
                {s}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
