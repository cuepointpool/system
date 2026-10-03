import Image from "next/image";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

/* /media/venue = real Cue Point photos. /media/story/gallery-* = Unsplash
   stock standing in for now — replace each with a real shot of the room. */
const PHOTOS = [
  {
    src: "/media/venue/neon-sign.jpg",
    alt: "The Cue Point Pool Parlour neon sign",
    focus: "50% 32%",
  },
  {
    src: "/media/story/gallery-hall.jpg",
    alt: "A pool table racked and ready under a hanging lamp",
    focus: "50% 60%",
  },
  {
    src: "/media/story/gallery-bridge.jpg",
    alt: "A player's bridge hand lining up the cue ball",
    focus: "50% 55%",
  },
  {
    src: "/media/venue/wall-art.jpg",
    alt: "Framed pool photographs on the wall at Cue Point",
    focus: "60% 45%",
  },
  {
    src: "/media/story/gallery-rack.jpg",
    alt: "A full rack of balls beside two cues",
    focus: "50% 65%",
  },
  {
    src: "/media/story/gallery-player.jpg",
    alt: "A player down on a shot",
    focus: "50% 50%",
  },
  {
    src: "/media/story/gallery-balls.jpg",
    alt: "Pool balls lined up along the cloth",
    focus: "50% 70%",
  },
  {
    src: "/media/story/gallery-cueball.jpg",
    alt: "A cue tip addressing the cue ball",
    focus: "50% 80%",
  },
] as const;

export function Gallery() {
  return (
    <section id="gallery" className="py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <SectionKicker>
            Inside the room
          </SectionKicker>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap">
              A first look at Cue Point
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              The sign, the walls and the game. More photos from our own room
              are on the way.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {PHOTOS.map((p, i) => (
            <Reveal key={p.src} delay={(i % 4) * 0.06}>
              <div className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-navy-900">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(max-width:1024px) 50vw, 25vw"
                  style={{ objectPosition: p.focus }}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
