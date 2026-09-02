import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { PlayersGrid } from "@/components/eco/PlayersGrid";
import { computeStats, getPlayers, toPlayerLite } from "@/lib/ecosystem/store";
import type { LeaderboardRow } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/players" },
  title: "Players",
  description:
    "The Cue Point player community — skill levels, rankings, recent form and win rates. Find someone to play.",
};

export default async function PlayersPage() {
  const [{ stats }, players] = await Promise.all([computeStats(), getPlayers()]);
  const rows: LeaderboardRow[] = players
    .map((p) => {
      const s = stats.get(p.id)!;
      return {
        ...toPlayerLite(p, s.rank),
        matchesPlayed: s.matchesPlayed,
        wins: s.wins,
        losses: s.losses,
        winPct: s.winPct,
        rankingPoints: s.rankingPoints,
        recentForm: s.recentForm,
        rankMovement: s.rankMovement,
        streak: s.streak,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return (
    <>
      <PageHero
        kicker="Cue Point community"
        wordmark="PLAYERS"
        title={
          <>
            The people on the <span className="text-teal-gradient">felt</span>
          </>
        }
        intro={`${rows.length} players and counting. Track their form, see how they rank, and find your next opponent.`}
      />
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <PlayersGrid initial={rows} />
      </section>
    </>
  );
}
