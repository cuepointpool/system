import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { BACKDROPS } from "@/lib/gallery";
import { NewTournament } from "@/components/friends/NewTournament";
import { requirePlayer } from "@/lib/friends/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New tournament",
  robots: { index: false, follow: false },
};

export default async function NewTournamentPage() {
  const { me } = await requirePlayer("/play/new-tournament");
  return (
    <>
      <PageHero
        image={BACKDROPS.breakOff}
        kicker="Friends · 8-Ball"
        title="Create a tournament"
        intro="Four quick steps. Pick the game, add who's playing, choose how to play — the matches are made for you."
      />
      <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <NewTournament me={me} />
      </div>
    </>
  );
}
