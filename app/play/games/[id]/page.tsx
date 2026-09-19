import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameLobby } from "@/components/friends/GameLobby";
import { requirePlayer } from "@/lib/friends/page";
import { getGameView } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Game",
  robots: { index: false, follow: false },
};

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, viewer } = await requirePlayer(`/play/games/${id}`);
  const game = await getGameView(id, actor);
  // a game you weren't added to doesn't exist for you
  if (!game) notFound();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <GameLobby initial={game} meId={viewer.id} />
    </div>
  );
}
