"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Campaign artwork with a two-step fallback.
 *
 *   1. `src`      — the file named in the asset brief (may not exist yet)
 *   2. `fallback` — shipped artwork that definitely exists
 *   3. a dark Cue Point placeholder naming the missing file
 *
 * That ordering means the campaign is fully art-directed today, and the
 * moment a real file lands at its intended name it takes over on its own.
 *
 * Small reward/currency icons do NOT use this: they fall back to inline SVG
 * (see Icons.tsx) because a text placeholder inside a 44px tile is unreadable.
 */
export function CampaignImage({
  src,
  fallback,
  alt,
  className,
  imageClassName,
  focus,
  sizes = "100vw",
  priority = false,
}: {
  src: string;
  /** shipped artwork to use when `src` is missing */
  fallback?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  /** object-position, e.g. "50% 35%" */
  focus?: string;
  sizes?: string;
  priority?: boolean;
}) {
  // 0 = intended art, 1 = shipped fallback, 2 = placeholder
  const [step, setStep] = useState(0);

  const candidates = fallback && fallback !== src ? [src, fallback] : [src];
  const current = candidates[step];
  const filename = src.split("/").pop() ?? src;

  return (
    <span className={cn("relative block overflow-hidden bg-navy-900", className)}>
      {current ? (
        <Image
          key={current}
          src={current}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onError={() => setStep((s) => s + 1)}
          className={cn("object-cover", imageClassName)}
          style={focus ? { objectPosition: focus } : undefined}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_120%_at_50%_0%,rgba(0,194,168,0.10),transparent_65%)] p-3 text-center">
          <span>
            <span className="mx-auto mb-1.5 block h-6 w-6 rounded-full border border-teal/40 bg-teal/10" />
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-mist/60">
              Missing asset
            </span>
            <span className="mt-0.5 block break-all text-[9px] leading-tight text-mist/35">
              {filename}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
