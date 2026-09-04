import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { LeaderboardView } from "@/components/game/LeaderboardView";
import { getViewer } from "@/lib/ecosystem/identity";
import { ARTWORK } from "@/lib/campaign/content";
import { getCampaignState } from "@/lib/campaign/progress";
import { getLeaderboard } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The Cue Point rank-points leaderboard — all time, monthly and weekly.",
};

export default async function LeaderboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/leaderboard");
  if (viewer.role !== "player") redirect("/admin");

  const [rows, state] = await Promise.all([
    getLeaderboard("all_time"),
    getCampaignState(viewer.id),
  ]);

  return (
    <GameShell
      title="Leaderboard"
      coins={state.summary.coins}
      level={state.summary.level}
      playerName={viewer.fullName}
      avatar={viewer.avatar}
      backdrop={ARTWORK.trophy}
      backdropFocus="50% 25%"
    >
      <LeaderboardView initial={rows} youId={viewer.id} />
    </GameShell>
  );
}
