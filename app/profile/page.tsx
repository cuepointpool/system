import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { ProfileView } from "@/components/game/ProfileView";
import { getViewer } from "@/lib/ecosystem/identity";
import { ARTWORK } from "@/lib/campaign/content";
import { getCampaignState } from "@/lib/campaign/progress";
import { getAchievements, getPlayerProfileView } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Cue Point player profile — level, stats, badges and mission history.",
};

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/profile");
  if (viewer.role !== "player") redirect("/admin");

  const [view, campaign, achievements] = await Promise.all([
    getPlayerProfileView(viewer.slug),
    getCampaignState(viewer.id),
    getAchievements(),
  ]);
  if (!view) redirect("/campaign");

  return (
    <GameShell
      title="Profile"
      coins={campaign.summary.coins}
      level={campaign.summary.level}
      playerName={viewer.fullName}
      avatar={viewer.avatar}
      backdrop={ARTWORK.felt}
      backdropFocus="60% 55%"
    >
      <ProfileView view={view} campaign={campaign} allAchievements={achievements} />
    </GameShell>
  );
}
