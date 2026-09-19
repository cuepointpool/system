import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentLobby } from "@/components/friends/TournamentLobby";
import { requirePlayer } from "@/lib/friends/page";
import { getTournamentView } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournament",
  robots: { index: false, follow: false },
};

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, viewer } = await requirePlayer(`/play/tournaments/${id}`);
  const tournament = await getTournamentView(id, actor);
  if (!tournament) notFound();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <TournamentLobby initial={tournament} meId={viewer.id} />
    </div>
  );
}
