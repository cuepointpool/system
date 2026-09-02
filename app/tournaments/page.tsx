import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { TournamentCard } from "@/components/eco/TournamentCard";
import { MagneticButton } from "@/components/MagneticButton";
import {
  derivedTournamentStatus,
  getTournaments,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/tournaments" },
  title: "Tournaments",
  description:
    "Cue Point tournaments — knockouts, leagues and the Pitipana Masters. Register with your Cue Point account.",
};

export default async function TournamentsPage() {
  const list = (await getTournaments()).map((t) => ({
    t: { ...t, status: derivedTournamentStatus(t) },
    registeredCount: t.registrations.filter((r) => r.playerId).length,
    spotsLeft: tournamentSpotsLeft(t),
  }));

  const open = list.filter((x) => x.t.status === "registration_open");
  const liveOrSoon = list.filter((x) =>
    ["live", "registration_closed", "upcoming"].includes(x.t.status),
  );
  const done = list.filter((x) => x.t.status === "completed");

  return (
    <>
      <PageHero
        kicker="Cue Point tournaments"
        wordmark="TOURNAMENTS"
        title={
          <>
            Compete for the <span className="text-teal-gradient">title</span>
          </>
        }
        intro="Seeded knockouts, cash prize pools and a live bracket board. Register from your Cue Point profile — one entry per player."
        actions={
          <MagneticButton href="/rankings" variant="ghost">
            Check the rankings
          </MagneticButton>
        }
      />
      <section className="mx-auto max-w-6xl space-y-14 px-5 pb-28 md:px-8">
        {list.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <p className="font-display text-xl font-bold text-white">
              No tournaments yet
            </p>
            <p className="mt-2 text-sm text-mist">
              Cue Point staff create tournaments from the operations console.
              Check back soon.
            </p>
          </div>
        )}
        {open.length > 0 && (
          <Group label="Open for registration">
            {open.map((x, i) => (
              <TournamentCard key={x.t.id} {...x} delay={i * 0.05} />
            ))}
          </Group>
        )}
        {liveOrSoon.length > 0 && (
          <Group label="Live & upcoming">
            {liveOrSoon.map((x, i) => (
              <TournamentCard key={x.t.id} {...x} delay={i * 0.05} />
            ))}
          </Group>
        )}
        {done.length > 0 && (
          <Group label="Completed">
            {done.map((x, i) => (
              <TournamentCard key={x.t.id} {...x} delay={i * 0.05} />
            ))}
          </Group>
        )}
      </section>
    </>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-5 text-xs uppercase tracking-[0.24em] text-teal">
        {label}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
