import type { Metadata } from "next";
import { PageHero } from "@/components/eco/Primitives";
import { BACKDROPS } from "@/lib/gallery";
import { TournamentCard } from "@/components/eco/TournamentCard";
import { MagneticButton } from "@/components/MagneticButton";
import { listOfficialTournaments } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/tournaments" },
  title: "Tournaments",
  description:
    "Cue Point pool tournaments in Pitipana, Homagama — knockouts, leagues and group stages. Sign up with your Cue Point account.",
};

export default async function TournamentsPage() {
  const list = await listOfficialTournaments();
  const open = list.filter((t) => t.status === "registration_open");
  const live = list.filter((t) => t.status === "in_progress");
  const done = list.filter((t) => t.status === "completed");

  return (
    <>
      <PageHero
        image={BACKDROPS.breakOff}
        kicker="Cue Point tournaments"
        wordmark="TOURNAMENTS"
        title={
          <>
            Compete for the <span className="text-teal-gradient">title</span>
          </>
        }
        intro="Knockouts, leagues and group stages, with prize pools and live results. Sign up with your Cue Point account — one entry per player."
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
              Cue Point announces its tournaments here. Check back soon.
            </p>
          </div>
        )}
        {live.length > 0 && (
          <Group label="Playing now">
            {live.map((t, i) => (
              <TournamentCard key={t.id} t={t} delay={i * 0.05} />
            ))}
          </Group>
        )}
        {open.length > 0 && (
          <Group label="Coming up — sign up">
            {open.map((t, i) => (
              <TournamentCard key={t.id} t={t} delay={i * 0.05} />
            ))}
          </Group>
        )}
        {done.length > 0 && (
          <Group label="Finished">
            {done.map((t, i) => (
              <TournamentCard key={t.id} t={t} delay={i * 0.05} />
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
