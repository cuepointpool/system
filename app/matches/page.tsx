import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { MatchHistory } from "@/components/eco/MatchHistory";
import {
  computeStats,
  getMatches,
  getPlayerBySlug,
  toPlayerLite,
} from "@/lib/ecosystem/store";
import type { MatchType } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match history",
  description:
    "Every recorded frame at Cue Point — casual, ranked and tournament — with scores, tables and ranking-point swings.",
};

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const focus = sp.player ? await getPlayerBySlug(sp.player) : undefined;
  const type = (["ranked", "casual", "tournament"] as MatchType[]).includes(
    sp.type as MatchType,
  )
    ? (sp.type as MatchType)
    : undefined;

  const [initial, { ranks }] = await Promise.all([
    getMatches({ playerId: focus?.id, type, limit: 80 }),
    computeStats(),
  ]);

  return (
    <>
      <PageHero
        kicker="Cue Point matches"
        wordmark="MATCHES"
        title={
          focus ? (
            <>
              {focus.nickname}&apos;s <span className="text-teal-gradient">frames</span>
            </>
          ) : (
            <>
              Every <span className="text-teal-gradient">recorded frame</span>
            </>
          )
        }
        intro={
          focus
            ? `Full match history for ${focus.fullName}.`
            : "Official results entered by Cue Point staff. Ranked and tournament frames move the leaderboard."
        }
      />
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <MatchHistory
          initial={initial}
          focusPlayer={
            focus ? toPlayerLite(focus, ranks.get(focus.id) ?? 0) : null
          }
        />
      </section>
    </>
  );
}
