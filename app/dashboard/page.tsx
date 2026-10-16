import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/eco/Primitives";
import { BACKDROPS } from "@/lib/gallery";
import { Dashboard } from "@/components/eco/Dashboard";
import { getViewer } from "@/lib/ecosystem/identity";
import { FriendsLeagueCard } from "@/components/friends/FriendsLeagueCard";
import { getFriendPoints, listOfficialTournaments } from "@/lib/friends/store";
import { PlayTimeCard } from "@/components/eco/PlayTimeCard";
import { playTimeFor } from "@/lib/play-logs";
import {
  getLoyaltyForPlayer,
  getMembershipPlans,
  getPlayerProfileView,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Cue Point control centre — ranking, form, membership, loyalty and upcoming matches.",
};

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/dashboard");
  // staff & admin use the operations console, not a player dashboard
  if (viewer.role !== "player") redirect("/admin");

  const [view, loyalty, plans, tournaments, friendPoints, playTime] = await Promise.all([
    getPlayerProfileView(viewer.slug),
    getLoyaltyForPlayer(viewer.id),
    getMembershipPlans(),
    listOfficialTournaments({ playerId: viewer.id }),
    getFriendPoints(viewer.id),
    playTimeFor(viewer.id),
  ]);
  if (!view) redirect("/players");
  const membershipPlan =
    plans.find((p) => p.id === viewer.membershipTier) ?? null;

  // profile completion score
  const p = view.profile;
  const checks = [
    !!p.bio,
    !!p.homeTable,
    !!p.avatar || true, // initials count
    view.stats.rankedMatches >= 5,
    p.membershipStatus === "active",
    view.achievements.length > 0,
  ];
  const completion = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100,
  );

  const registeredTournaments = tournaments
    .filter((t) => t.status === "registration_open" || t.status === "in_progress")
    .map((t) => ({ name: t.name, slug: t.slug, startAt: t.startAt }));

  return (
    <>
      <PageHero
        image={BACKDROPS.logoWall}
        kicker={`Cue Point · ${viewer.nickname}`}
        title={
          <>
            Your <span className="text-teal-gradient">control centre</span>
          </>
        }
        intro="Everything that matters between visits — where you rank, who you play next, what you've earned."
      />
      <div className="mx-auto grid max-w-6xl gap-5 px-5 pb-6 md:grid-cols-2 md:px-8">
        <PlayTimeCard playTime={playTime} />
        <FriendsLeagueCard points={friendPoints} />
      </div>
      <Dashboard
        view={view}
        loyalty={loyalty}
        membershipPlan={membershipPlan}
        completion={completion}
        registeredTournaments={registeredTournaments}
      />
    </>
  );
}
