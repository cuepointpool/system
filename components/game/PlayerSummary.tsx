import Link from "next/link";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { XpBar } from "./XpBar";

/** Compact identity + XP strip used at the top of the campaign home. */
export function PlayerSummary({
  nickname,
  avatar,
  level,
  xpIntoLevel,
  xpForLevel,
}: {
  nickname: string;
  avatar: string | null;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
}) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-900/70 p-3.5 transition-colors active:bg-white/[0.05]"
    >
      <PlayerAvatar name={nickname} src={avatar} size="md" ring />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-base font-bold text-white">
            {nickname}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-mist">
            {xpIntoLevel.toLocaleString()} / {xpForLevel.toLocaleString()} XP
          </span>
        </div>
        <div className="mt-1 text-[13px] font-semibold text-teal">Level {level}</div>
        <XpBar value={xpIntoLevel} max={xpForLevel} className="mt-2" />
      </div>
    </Link>
  );
}
