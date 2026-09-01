"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import cover from "@/public/media/cover.png";
import mark from "@/public/media/logo-mark.png";
import { Reveal } from "./Reveal";

type Tile =
  | { kind: "image"; pos: string; label: string; h: string }
  | { kind: "felt"; label: string; h: string }
  | { kind: "mark"; h: string }
  | { kind: "stat"; big: string; small: string; h: string };

const COLS: Tile[][] = [
  [
    { kind: "image", pos: "object-[82%_35%]", label: "The break", h: "h-[280px]" },
    { kind: "stat", big: "9ft", small: "American pool in the VIP booth", h: "h-[200px]" },
    { kind: "felt", label: "Rack &amp; run", h: "h-[240px]" },
  ],
  [
    { kind: "mark", h: "h-[220px]" },
    { kind: "image", pos: "object-[100%_50%]", label: "Under the lights", h: "h-[320px]" },
    { kind: "stat", big: "2AM", small: "last frame, every night", h: "h-[180px]" },
  ],
  [
    { kind: "felt", label: "Baize you can trust", h: "h-[240px]" },
    { kind: "image", pos: "object-[92%_75%]", label: "Closing time", h: "h-[260px]" },
    { kind: "mark", h: "h-[220px]" },
  ],
];

export function Gallery() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yA = useTransform(scrollYProgress, [0, 1], ["6%", "-12%"]);
  const yB = useTransform(scrollYProgress, [0, 1], ["-8%", "10%"]);
  const yC = useTransform(scrollYProgress, [0, 1], ["3%", "-16%"]);
  const ys = [yA, yB, yC];

  return (
    <section id="gallery" className="relative overflow-hidden py-20 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="text-xs uppercase tracking-[0.35em] text-teal">Inside the room</span>
            <h2 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl">
              Low light. <span className="text-teal-gradient">Green baize.</span> The sound of a clean pot.
            </h2>
          </div>
          <p className="max-w-xs text-sm text-mist">
            A glimpse of the floor — the real thing is better with a cue in your hand.
          </p>
        </Reveal>
      </div>

      <div ref={ref} className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 px-5 md:grid-cols-3 md:px-8">
        {COLS.map((col, ci) => (
          <motion.div
            key={ci}
            style={{ y: ys[ci] }}
            className={`flex flex-col gap-4 ${ci === 1 ? "md:mt-14" : ""}`}
          >
            {col.map((tile, ti) => (
              <GalleryTile key={ti} tile={tile} />
            ))}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function GalleryTile({ tile }: { tile: Tile }) {
  return (
    <div
      className={`group relative w-full overflow-hidden rounded-3xl border border-white/[0.06] ${tile.h}`}
      data-cursor="hot"
    >
      {tile.kind === "image" && (
        <>
          <Image
            src={cover}
            alt={tile.label.replace(/&amp;/g, "&")}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className={`scale-[1.6] object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.72] ${tile.pos}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/20 to-transparent transition-colors duration-500" />
          <div className="absolute inset-0 opacity-0 mix-blend-color transition-opacity duration-500 group-hover:opacity-100 bg-teal/40" />
        </>
      )}

      {tile.kind === "felt" && (
        <div className="felt absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#05090f] text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-110">
              <span className="font-display text-lg">8</span>
            </span>
          </div>
        </div>
      )}

      {tile.kind === "mark" && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(0,194,168,0.18),transparent_60%)]">
          <Image
            src={mark}
            alt=""
            aria-hidden
            className="w-24 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6"
          />
        </div>
      )}

      {tile.kind === "stat" && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-br from-navy-800 to-navy-950 p-6">
          <span className="font-display text-5xl font-bold text-white">{tile.big}</span>
          <span
            className="mt-2 text-sm text-mist"
            dangerouslySetInnerHTML={{ __html: tile.small }}
          />
        </div>
      )}

      {"label" in tile && (
        <span
          className="absolute bottom-4 left-4 rounded-full glass px-3 py-1.5 text-xs text-white"
          dangerouslySetInnerHTML={{ __html: tile.label }}
        />
      )}
    </div>
  );
}
