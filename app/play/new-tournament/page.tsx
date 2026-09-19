import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
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
        kicker="Friends · 8-Ball"
        title="Create a tournament"
        intro="Choose the format and size, add your friends, and the bracket builds itself when you start."
      />
      <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <NewTournament me={me} />
      </div>
    </>
  );
}
