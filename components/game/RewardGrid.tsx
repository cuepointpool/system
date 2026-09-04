"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BadgeIcon, CoinIcon, CueIcon, XpIcon } from "./Icons";
import type { MissionReward, RewardKind } from "@/lib/campaign/content";

/**
 * Square reward tiles. Unlike mission artwork these fall back to inline SVG
 * rather than a "missing asset" plate — a text placeholder in a 56px tile is
 * unreadable, and the reward still needs to be legible before art lands.
 */
const FALLBACK: Record<RewardKind, (p: { className?: string }) => React.ReactElement> = {
  coins: CoinIcon,
  xp: XpIcon,
  item: CueIcon,
  badge: BadgeIcon,
};

export function RewardGrid({
  rewards,
  earned = false,
}: {
  rewards: MissionReward[];
  earned?: boolean;
}) {
  return (
    <ul
      className={cn(
        "grid gap-2",
        rewards.length >= 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {rewards.map((r) => (
        <li key={`${r.kind}-${r.value}`}>
          <RewardTile reward={r} earned={earned} />
        </li>
      ))}
    </ul>
  );
}

function RewardTile({ reward, earned }: { reward: MissionReward; earned: boolean }) {
  const [failed, setFailed] = useState(false);
  const Fallback = FALLBACK[reward.kind];

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-3 text-center",
        earned
          ? "border-teal/35 bg-teal/[0.07]"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <span className="relative grid h-11 w-11 place-items-center">
        {failed ? (
          <Fallback className="h-10 w-10" />
        ) : (
          <Image
            src={reward.image}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-11 w-11 object-contain"
          />
        )}
      </span>
      <span className="font-display text-[13px] font-bold leading-tight text-white">
        {reward.value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-mist/70">
        {reward.label}
      </span>
    </div>
  );
}
