import Link from "next/link";
import { Reveal } from "./Reveal";
import { GalleryGrid } from "./GalleryGrid";
import { SectionKicker } from "@/components/BrandMark";
import { GALLERY } from "@/lib/gallery";

/** Homepage gallery: a handful of real photos, the rest on /gallery. */
export function Gallery({ limit = 8 }: { limit?: number }) {
  const photos = GALLERY.slice(0, limit);
  return (
    <section id="gallery" className="py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <SectionKicker>Inside the room</SectionKicker>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap">
              Life at Cue Point
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              The tables, the lights and the people who play here. Tap any photo
              to see it full size.
            </p>
          </div>
        </Reveal>

        <div className="mt-12">
          <GalleryGrid photos={photos} tiles />
        </div>

        {GALLERY.length > photos.length && (
          <div className="mt-8 text-center">
            <Link href="/gallery" className="btn-ghost px-6 py-3 text-sm">
              See all {GALLERY.length} photos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
