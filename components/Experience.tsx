import Image from "next/image";
import Link from "next/link";
import { FEATURES } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

export function Experience() {
  return (
    <section id="experience" className="py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <SectionKicker>
            Why players keep coming back
          </SectionKicker>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap">
              Built for the serious and the social
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              Four things we care about so you can just chalk up and play.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.07}>
              <FeatureCard f={f} />
            </Reveal>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-lg leading-relaxed text-white">
            Whether you&rsquo;re chasing trophies or just a good night out,
            there is a table here for you.
          </p>
          <Link
            href="/book"
            className="inline-flex shrink-0 items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
          >
            Book a table
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ f }: { f: (typeof FEATURES)[number] }) {
  return (
    <Link href={f.href} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-navy-900 sm:aspect-[4/5]">
        <Image
          src={f.image}
          alt={f.alt}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
          style={{ objectPosition: f.focus }}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold leading-tight text-gold lg:text-2xl">
        {f.title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-white/85">{f.body}</p>
      <span className="mt-3 inline-block text-[12px] font-bold uppercase tracking-[0.08em] text-white underline decoration-white/40 underline-offset-4 transition-colors duration-200 group-hover:text-gold group-hover:decoration-gold">
        {f.cta}
      </span>
    </Link>
  );
}
