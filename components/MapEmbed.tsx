"use client";

import { useEffect, useRef, useState } from "react";

const MAP_SRC =
  "https://www.openstreetmap.org/export/embed.html?bbox=79.965%2C6.815%2C80.045%2C6.875&layer=mapnik&marker=6.845%2C80.005";

/** Click-/scroll-to-load map. Keeps the third-party iframe out of the
 *  initial render (weight + SEO) until the section is actually in view
 *  or the visitor asks for it. */
export function MapEmbed() {
  const [show, setShow] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show || !box.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [show]);

  return (
    <div ref={box} className="absolute inset-0">
      {show ? (
        <iframe
          title="Map to Cue Point, Pitipana, Homagama"
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={MAP_SRC}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShow(true)}
          aria-label="Load the map"
          className="absolute inset-0 grid place-items-center bg-navy-900/60 text-xs font-medium text-white/80 transition-colors hover:text-teal"
        >
          <span className="rounded-full glass-strong px-4 py-2">Load map</span>
        </button>
      )}
    </div>
  );
}
