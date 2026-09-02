import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { MembershipView } from "@/components/eco/MembershipView";
import { getViewer } from "@/lib/ecosystem/identity";
import { getMembershipPlans, getRewards } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/membership" },
  title: "Membership",
  description:
    "Cue Point membership — Basic, Pro and Elite. Better pricing, priority booking, ranked play, tournament perks and faster loyalty earning.",
};

export default async function MembershipPage() {
  const [viewer, plans, rewards] = await Promise.all([
    getViewer(),
    getMembershipPlans(),
    getRewards(),
  ]);
  return (
    <>
      <PageHero
        kicker="Cue Point membership"
        wordmark="MEMBERSHIP"
        title={
          <>
            More than a <span className="text-teal-gradient">login</span>
          </>
        }
        intro="Your profile, your stats and your ranking come free. Membership adds better pricing, priority booking and a place in the competitive scene."
      />
      <MembershipView
        plans={plans}
        rewards={rewards}
        currentTier={viewer?.membershipTier ?? null}
      />
    </>
  );
}
