import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { NewGame } from "@/components/friends/NewGame";
import { requirePlayer } from "@/lib/friends/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New game",
  robots: { index: false, follow: false },
};

export default async function NewGamePage() {
  const { me } = await requirePlayer("/play/new-game");
  return (
    <>
      <PageHero
        kicker="Friends · 8-Ball"
        title="Create a game"
        intro="Pick the format, add your friends, and start once everyone has accepted."
      />
      <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <NewGame me={me} />
      </div>
    </>
  );
}
