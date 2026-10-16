import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentLobby } from "@/components/friends/TournamentLobby";
import { getViewer } from "@/lib/ecosystem/identity";
import { getTournamentView, officialIdBySlug, type Actor } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

/** nobody signed in — an official tournament is still public */
const PUBLIC: Actor = { id: "", role: "player", nickname: "" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = await officialIdBySlug(slug);
  const t = id ? await getTournamentView(id, PUBLIC) : null;
  if (!t?.official) return { title: "Tournament not found" };
  return {
    title: t.name,
    description: t.official.summary ?? `${t.name} — a Cue Point pool tournament in Pitipana, Homagama.`,
    alternates: { canonical: `/tournaments/${t.official.slug}` },
  };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await officialIdBySlug(slug);
  if (!id) notFound();
  const viewer = await getViewer();
  const actor: Actor = viewer ? { id: viewer.id, role: viewer.role, nickname: viewer.nickname } : PUBLIC;
  const tournament = await getTournamentView(id, actor);
  if (!tournament?.official) notFound();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <TournamentLobby initial={tournament} meId={viewer?.id ?? ""} />
    </div>
  );
}
