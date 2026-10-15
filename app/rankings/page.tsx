import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { BACKDROPS } from "@/lib/gallery";
import { LeaderboardTabs } from "@/components/eco/LeaderboardTabs";
import { getCampaignLeaderboard } from "@/lib/campaign/progress";
import { getLeaderboard, getRankedLeaderboard } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/rankings" },
  title: "Rankings",
  description:
    "Cue Point leaderboards — the in-house board for every registered player, and the Ranked board from Cue Point-hosted tournaments.",
};

export default async function RankingsPage() {
  const [rows, ranked, gameRows] = await Promise.all([
    getLeaderboard("all_time"),
    getRankedLeaderboard(),
    getCampaignLeaderboard(),
  ]);
  const top = rows[0];

  return (
    <>
      <PageHero
        image={BACKDROPS.kingTable}
        kicker="Cue Point rankings"
        wordmark="RANKINGS"
        title={
          <>
            The <span className="text-teal-gradient">leaderboard</span>
          </>
        }
        intro={
          <>
            Two boards. <span className="text-white">In-house</span> ranks every
            registered player on every match played here.{" "}
            <span className="text-white">Ranked</span> counts only the tournaments
            Cue Point hosts.
            {top && (
              <>
                {" "}
                In-house #1:{" "}
                <span className="text-white">{top.nickname}</span> on{" "}
                {top.rankingPoints.toLocaleString()} pts.
              </>
            )}
          </>
        }
      />
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        {rows.length === 0 && gameRows.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <p className="font-display text-xl font-bold text-white">
              The board is empty
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
              Rankings appear as soon as the first ranked or tournament match is
              recorded by Cue Point staff.
            </p>
          </div>
        ) : (
          <LeaderboardTabs official={rows} ranked={ranked} game={gameRows} />
        )}
      </section>
    </>
  );
}
