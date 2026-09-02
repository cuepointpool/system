import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { OffersView } from "@/components/eco/OffersView";
import { getPromotions } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/offers" },
  title: "Offers",
  description:
    "Current Cue Point offers and promotions — happy hour, student rates, group packages and tournament deals.",
};

export default async function OffersPage() {
  const all = await getPromotions({ includeExpired: true });
  return (
    <>
      <PageHero
        kicker="Cue Point offers"
        wordmark="OFFERS"
        title={
          <>
            Deals worth <span className="text-teal-gradient">racking up</span> for
          </>
        }
        intro="Happy hours, student rates, group packages and tournament promos. Offers switch on and off automatically by date."
      />
      <OffersView
        active={all.filter((p) => p.state === "active")}
        upcoming={all.filter((p) => p.state === "upcoming")}
        expired={all.filter((p) => p.state === "expired")}
      />
    </>
  );
}
