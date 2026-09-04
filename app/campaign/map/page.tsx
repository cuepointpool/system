import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { CampaignMapView } from "@/components/game/CampaignMapView";
import { getViewer } from "@/lib/ecosystem/identity";
import { getCampaignState } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign map",
  description: "Work down the Cue Point campaign path, chapter by chapter.",
};

export default async function CampaignMapPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/campaign/map");
  if (viewer.role !== "player") redirect("/admin");

  const state = await getCampaignState(viewer.id);

  return (
    <GameShell
      title="Campaign"
      coins={state.summary.coins}
      level={state.summary.level}
      playerName={viewer.fullName}
      avatar={viewer.avatar}
      back="/campaign"
    >
      <Suspense fallback={<MapSkeleton />}>
        <CampaignMapView initial={state} />
      </Suspense>
    </GameShell>
  );
}

function MapSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 w-[132px] shrink-0 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="h-[500px] animate-pulse rounded-2xl bg-white/[0.03]" />
    </div>
  );
}
