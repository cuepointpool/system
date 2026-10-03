import { BookingWidget, type TableOption } from "./BookingWidget";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

export function BookingSection({ tables = [] }: { tables?: TableOption[] }) {
  return (
    <section id="reserve" className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Reveal className="mb-10 text-center">
          <SectionKicker>
            Reserve
          </SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            Pick a day and a time
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-mist">
            See what is free, choose your slot and get a reference to show at
            the counter.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <BookingWidget tables={tables} />
        </Reveal>
      </div>
    </section>
  );
}
