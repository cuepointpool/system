"use client";

import { MissionNode } from "./MissionNode";
import { CampaignImage } from "./CampaignImage";
import { SEASON } from "@/lib/campaign/content";
import type { ChapterView, MissionView } from "@/lib/campaign/progress";

/**
 * The vertical mission path.
 *
 * Nodes sit on a centred, fixed-max-width track and are placed as a
 * percentage of that track, so the dotted SVG spine (percentage viewBox)
 * lines up with them at every screen size and the map only ever scrolls
 * vertically — no horizontal scrolling, no zooming.
 */

/** Horizontal position of each node as a % of the track, cycling down the path. */
const LANES = [50, 70, 58, 34, 22, 38, 62, 74, 56, 46];

const ROW = 118; // vertical rhythm per mission
const NODE_TOP = 44; // node centre offset inside its row

export function CampaignMap({
  chapter,
  missions,
  onSelect,
}: {
  chapter: ChapterView;
  missions: MissionView[];
  onSelect: (m: MissionView) => void;
}) {
  const height = missions.length * ROW + 48;
  const laneAt = (i: number) => LANES[i % LANES.length];

  return (
    <div className="relative -mx-4 overflow-hidden">
      {/* pool-hall backdrop — each chapter uses its own artwork, tinted with
          the chapter accent so the map feels different as you progress */}
      <div className="absolute inset-0">
        <CampaignImage
          src={chapter.image}
          fallback={chapter.artwork ?? SEASON.background}
          focus={chapter.focus}
          alt=""
          className="absolute inset-0 h-full w-full"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.94)_0%,rgba(5,16,28,0.6)_35%,rgba(5,16,28,0.7)_72%,rgba(5,16,28,0.97)_100%)]" />
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            background: `radial-gradient(90% 55% at 50% 8%, ${chapter.accent}, transparent 70%)`,
          }}
        />
      </div>

      <div
        className="relative mx-auto w-full max-w-[420px]"
        style={{ height }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${height}`}
          aria-hidden
        >
          <path
            d={spinePath(missions.length, laneAt)}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
            strokeDasharray="2 3.2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {missions.map((m, i) => (
          <div
            key={m.id}
            className="absolute -translate-x-1/2"
            style={{ left: `${laneAt(i)}%`, top: i * ROW + 12 }}
          >
            <MissionNode mission={m} accent={chapter.accent} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dotted path connecting node centres, in the SVG's percentage viewBox. */
function spinePath(count: number, laneAt: (i: number) => number): string {
  if (count === 0) return "";
  const y = (i: number) => i * ROW + NODE_TOP;
  let d = `M ${laneAt(0)} ${y(0)}`;
  for (let i = 1; i < count; i++) {
    const midY = (y(i - 1) + y(i)) / 2;
    d += ` C ${laneAt(i - 1)} ${midY}, ${laneAt(i)} ${midY}, ${laneAt(i)} ${y(i)}`;
  }
  return d;
}
