import type { Metadata } from "next";
import Image from "next/image";
import { MembershipView } from "@/components/eco/MembershipView";
import { getViewer } from "@/lib/ecosystem/identity";
import { getMembershipPlans, getRewards } from "@/lib/ecosystem/store";
import { SectionKicker } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/membership" },
  title: "Membership",
  description:
    "Cue Point membership: a free Basic account, plus Pro and Elite with money off table time and faster points. See what each plan costs and what your points get you.",
};

export default async function MembershipPage() {
  const [viewer, plans, rewards] = await Promise.all([
    getViewer(),
    getMembershipPlans(),
    getRewards(),
  ]);
  return (
    <>
      <section className="relative isolate overflow-hidden pb-14 pt-36 sm:pb-20 sm:pt-44">
        <Image
          src="/media/story/why-tables.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[50%_60%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/80 to-navy-950/50" />
        <div className="px-5 md:px-8 lg:px-12">
          <SectionKicker>
            Cue Point membership
          </SectionKicker>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.02] text-white sm:text-5xl md:text-6xl">
            Play more, pay less, earn points
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90">
            A Basic account is free and gives you a profile, your stats and points on every
            visit. Pro and Elite take money off your table time and earn points faster.
          </p>
        </div>
      </section>

      <MembershipView
        plans={plans}
        rewards={rewards}
        currentTier={viewer?.membershipTier ?? null}
        signedIn={!!viewer}
        points={viewer && viewer.role === "player" ? viewer.loyaltyPoints : null}
      />
    </>
  );
}
