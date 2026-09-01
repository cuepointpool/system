import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentDetail } from "@/components/eco/TournamentDetail";
import { getViewer } from "@/lib/ecosystem/identity";
import {
  computeStats,
  derivedTournamentStatus,
  getPlayers,
  getTournamentBySlug,
  isRegistered,
  toPlayerLite,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";
import type { PlayerLite } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return { title: "Tournament not found" };
  return { title: t.name, description: t.summary };
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();

  const [viewer, allPlayers, { ranks }] = await Promise.all([
    getViewer(),
    getPlayers(),
    computeStats(),
  ]);
  const registered = await isRegistered(slug, viewer?.id ?? null);

  const players: Record<string, PlayerLite> = {};
  for (const p of allPlayers) {
    players[p.id] = toPlayerLite(p, ranks.get(p.id) ?? 0);
  }

  return (
    <div className="pt-24 sm:pt-28">
      <TournamentDetail
        tournament={{ ...t, status: derivedTournamentStatus(t) }}
        players={players}
        spotsLeft={tournamentSpotsLeft(t)}
        registered={registered}
        viewerName={viewer?.nickname ?? null}
      />
    </div>
  );
}
