import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { SeasonCard } from "@/components/game/SeasonCard";
import { CampaignProgress } from "@/components/game/CampaignProgress";
import { getViewer } from "@/lib/ecosystem/identity";
import { ARTWORK } from "@/lib/campaign/content";
import { getCampaignState } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign progress",
  description: "Season 1 completion, stars earned and chapter-by-chapter progress.",
};

export default async function CampaignProgressPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/campaign/progress");
  if (viewer.role !== "player") redirect("/admin");

  const { summary, chapters } = await getCampaignState(viewer.id);

  return (
    <GameShell
      title="Progress"
      coins={summary.coins}
      level={summary.level}
      playerName={viewer.fullName}
      avatar={viewer.avatar}
      backdrop={ARTWORK.trophy}
      backdropFocus="50% 30%"
      back="/campaign"
    >
      <div className="space-y-4 pt-2">
        <SeasonCard />
        <CampaignProgress summary={summary} chapters={chapters} />
      </div>
    </GameShell>
  );
}
