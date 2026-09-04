import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { SeasonCard } from "@/components/game/SeasonCard";
import { PlayerSummary } from "@/components/game/PlayerSummary";
import { ChapterCard } from "@/components/game/ChapterCard";
import { NextMissionCard } from "@/components/game/NextMissionCard";
import { ChevronIcon } from "@/components/game/Icons";
import { getViewer } from "@/lib/ecosystem/identity";
import { ARTWORK } from "@/lib/campaign/content";
import { getCampaignState } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign",
  description:
    "Campaign Mode — rise through the ranks across 100 missions, earn XP, stars and rewards at Cue Point.",
};

export default async function CampaignPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/campaign");
  if (viewer.role !== "player") redirect("/admin");

  const { summary, chapters, missions } = await getCampaignState(viewer.id);
  const chapter = chapters[summary.currentChapter - 1] ?? chapters[0];
  const next = missions.find((m) => m.id === summary.currentMissionId);

  return (
    <GameShell
      title="Campaign"
      coins={summary.coins}
      level={summary.level}
      playerName={viewer.fullName}
      avatar={viewer.avatar}
      backdrop={ARTWORK.parlour}
      backdropFocus="50% 45%"
    >
      <div className="space-y-4">
        <CampaignHeader summary={summary} />

        {next && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-white">
                Continue where you left off
              </h3>
              <span className="text-[11px] text-mist">
                Chapter {next.chapter}
              </span>
            </div>
            <NextMissionCard mission={next} />
          </section>
        )}

        <PlayerSummary
          nickname={viewer.nickname}
          avatar={viewer.avatar}
          level={summary.level}
          xpIntoLevel={summary.xpIntoLevel}
          xpForLevel={summary.xpForLevel}
        />

        <ChapterCard chapter={chapter} />

        <SeasonCard />

        <Link
          href="/campaign/progress"
          className="flex min-h-[52px] items-center justify-between rounded-2xl border border-white/10 bg-navy-900/70 px-4 text-[14px] font-semibold text-white"
        >
          <span>
            Campaign progress
            <span className="ml-2 text-[12px] font-normal text-mist">
              {summary.missionsCompleted} / {summary.missionsTotal} missions
            </span>
          </span>
          <ChevronIcon className="h-4 w-4 text-teal" />
        </Link>
      </div>
    </GameShell>
  );
}
