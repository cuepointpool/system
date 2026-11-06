import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClubLobby } from "@/components/clubs/ClubLobby";
import { clubActor, clubSlugOfTournament, clubViewer } from "@/lib/clubs/store";
import { getViewer } from "@/lib/ecosystem/identity";
import { getTournamentView, type Actor } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club league",
  robots: { index: false, follow: false },
};

/** nobody signed in — club leagues are public to follow */
const PUBLIC: Actor = { id: "", role: "player", nickname: "" };

export default async function ClubTournamentPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if ((await clubSlugOfTournament(id)) !== slug) notFound();

  // the club's own admin runs it; anyone else watches (players play their own matches)
  const club = await clubViewer();
  const asClub = !!club && club.slug === slug;
  const viewer = asClub ? null : await getViewer();
  const actor: Actor = asClub
    ? clubActor(club!)
    : viewer
      ? { id: viewer.id, role: viewer.role, nickname: viewer.nickname }
      : PUBLIC;

  const tournament = await getTournamentView(id, actor);
  if (!tournament?.club) notFound();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <ClubLobby initial={tournament} meId={actor.id} asClub={asClub} />
    </div>
  );
}
