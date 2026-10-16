import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/eco/Primitives";
import { NewTournament } from "@/components/friends/NewTournament";
import { getViewer } from "@/lib/ecosystem/identity";
import { BACKDROPS } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New official tournament",
  robots: { index: false, follow: false },
};

export default async function NewOfficialTournamentPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/account?next=/admin/tournaments/new");
  if (viewer.role === "player") redirect("/play/new-tournament");
  return (
    <>
      <PageHero
        image={BACKDROPS.breakOff}
        kicker="Cue Point · official"
        title="Create an official tournament"
        intro="The same four steps as a friends tournament, plus the event details. It appears on the Tournaments page for players to sign up."
      />
      <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <NewTournament me={null} official />
      </div>
    </>
  );
}
