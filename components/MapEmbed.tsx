"use client";

import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/config";

// The same embed Google hands out under Share → "Embed a map": our own listing,
// centred on its pin, zoomed to street level, with the place card. No API key.
const { geo, googlePlaceId, googleName } = SITE.address;
const SPAN_M = 1980; // metres shown across the map — about zoom 17
const MAP_SRC =
  "https://www.google.com/maps/embed?pb=" +
  [
    `!1m18!1m12!1m3!1d${SPAN_M}!2d${geo.lng}!3d${geo.lat}`,
    "!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1",
    `!3m3!1m2!1s${encodeURIComponent(googlePlaceId)}!2s${encodeURIComponent(googleName)}`,
    "!5e0!3m2!1sen!2slk!5m2!1sen!2slk",
  ].join("");

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
          title="Google map to Cue Point, Pitipana, Homagama"
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={MAP_SRC}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShow(true)}
          aria-label="Load the map"
          className="absolute inset-0 grid place-items-center bg-navy-900 text-sm font-semibold text-white underline underline-offset-4"
        >
          Load map
        </button>
      )}
    </div>
  );
}
