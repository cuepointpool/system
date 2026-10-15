"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { GalleryPhoto } from "@/lib/gallery";

/** Photo grid — masonry, or even `tiles` for a tidy block. Tap a photo to open
 *  it full screen (←/→ and Esc work). */
export function GalleryGrid({
  photos,
  tiles = false,
}: {
  photos: GalleryPhoto[];
  tiles?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  const cur = open == null ? null : photos[open];

  return (
    <>
      <div
        className={
          tiles
            ? "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            : "columns-2 gap-3 sm:gap-4 lg:columns-3 xl:columns-4"
        }
      >
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className={
              tiles
                ? "group relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-navy-900"
                : "group relative mb-3 block w-full overflow-hidden rounded-lg bg-navy-900 sm:mb-4"
            }
            aria-label={`Open photo: ${p.alt}`}
          >
            {tiles ? (
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width:1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <Image
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                sizes="(max-width:1024px) 50vw, (max-width:1280px) 33vw, 25vw"
                className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]"
              />
            )}
            <span className="pointer-events-none absolute inset-0 bg-navy-950/0 transition-colors group-hover:bg-navy-950/15" />
          </button>
        ))}
      </div>

      {cur && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={cur.alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div className="relative h-full max-h-[88vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Image src={cur.src} alt={cur.alt} fill sizes="100vw" className="object-contain" priority />
          </div>
          <p className="absolute inset-x-4 bottom-4 text-center text-xs text-white/70">
            {cur.alt} · {open! + 1} / {photos.length}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:left-6"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:right-6"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
