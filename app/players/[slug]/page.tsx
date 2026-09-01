import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/eco/ProfileView";
import { getPlayerProfileView } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const v = await getPlayerProfileView(slug);
  if (!v) return { title: "Player not found" };
  return {
    title: `${v.profile.nickname} — Player profile`,
    description: `${v.profile.fullName} · ${v.profile.skillLevel} · Rank #${v.stats.rank} at Cue Point with ${v.stats.wins}-${v.stats.losses} and a ${v.stats.winPct}% win rate.`,
  };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await getPlayerProfileView(slug);
  if (!view) notFound();

  return (
    <div className="pt-24 sm:pt-28">
      <ProfileView view={view} />
    </div>
  );
}
