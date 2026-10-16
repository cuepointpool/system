import { HOURS_DISPLAY, SITE, TABLE_HALF_HOUR_RATE, TABLE_HOURLY_RATE } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

/** plain-text questions and answers — shown on the page and given to search
 *  engines as FAQPage structured data, so both always say the same thing */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does a pool table cost at Cue Point?",
    a: `${lkr(TABLE_HOURLY_RATE)} an hour for the whole table, however many of you are playing. Half an hour is ${lkr(TABLE_HALF_HOUR_RATE)}. Every table costs the same, the private booth included.`,
  },
  {
    q: "What are your opening hours?",
    a: `We are open ${HOURS_DISPLAY[0].day.toLowerCase()}, ${HOURS_DISPLAY[0].time}.`,
  },
  {
    q: "Where is Cue Point?",
    a: `${SITE.address.line1}, ${SITE.address.line2}, ${SITE.address.country}. Search "Cue Point" on Google Maps or use the code ${SITE.address.plusCode}.`,
  },
  {
    q: "How do I book a table?",
    a: `Members book a table online: pick a day, a time and a table, and you get a booking reference to show at the counter. Joining is free. You can also call us on ${SITE.phone}, or just walk in.`,
  },
  {
    q: "What tables do you have?",
    a: "Three full-size 9ft King Model international pool tables. One of them is in a private booth.",
  },
  {
    q: "Do I need to be a good player?",
    a: "No. Rookies and regulars play side by side. Come for a casual game with friends, or log your matches to climb the player rankings and enter tournaments.",
  },
  {
    q: "Can I run a tournament with my friends?",
    a: "Yes. Sign in, open Friends, pick a format and add your friends. The bracket builds itself, and you enter each result straight from your phone.",
  },
];

export function Faq() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section id="faq" className="border-t border-white/10 bg-navy-950 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <Reveal className="mb-10 text-center">
          <SectionKicker>Questions</SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            Pool at Cue Point: your questions answered
          </h2>
        </Reveal>

        <div className="divide-y divide-white/10 border-y border-white/10">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-semibold text-white sm:text-lg">{f.q}</h3>
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/20 text-teal transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-mist">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        // built from the constants above — safe to inline
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
    </section>
  );
}
