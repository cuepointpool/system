import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { GalleryGrid } from "@/components/GalleryGrid";
import { BACKDROPS, GALLERY } from "@/lib/gallery";

export const metadata: Metadata = {
  alternates: { canonical: "/gallery" },
  title: "Gallery",
  description:
    "Photos from inside Cue Point Pool Parlour — the tables, the neon, and the players who make the room.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        kicker="Cue Point gallery"
        wordmark="GALLERY"
        image={BACKDROPS.logoWall}
        title={
          <>
            Inside <span className="text-teal-gradient">the room</span>
          </>
        }
        intro="The tables, the lights and the people who play here. Tap any photo to see it full size."
      />
      <div className="px-5 pb-28 pt-4 md:px-8 lg:px-12">
        <GalleryGrid photos={GALLERY} />
      </div>
    </>
  );
}
