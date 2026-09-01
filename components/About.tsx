import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { getLeaderboard } from "@/lib/ecosystem/store";
import type { LeaderboardRow } from "@/lib/ecosystem/types";
import cover from "@/public/media/cover.png";

/* ======================================================================== */
/*  "The Cue Point story" — three standalone panels:                         */
/*  climb the ranks · the room · tournaments. Rankings card is live data.    */
/* ======================================================================== */

export async function About() {
  const top = (await getLeaderboard("all_time")).slice(0, 5);

  return (
    <section id="story" className="relative overflow-hidden bg-navy-950 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-navy-950" />
      <div className="pointer-events-none absolute left-1/2 top-8 -z-10 h-[380px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-full bg-teal/8 blur-[130px]" />

      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <span className="text-xs font-medium uppercase tracking-[0.32em] text-teal">
            The Cue Point story
          </span>
          <h2 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            More than a table for an hour
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Reveal className="h-full">
            <RankPanel top={top} />
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <AmbiencePanel />
          </Reveal>
          <Reveal delay={0.16} className="h-full">
            <TournamentPanel />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

const panelBase =
  "group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-white/[0.06] p-7 transition-colors duration-300 hover:border-teal/25 sm:p-8 lg:min-h-[500px]";

function PanelButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-teal/45 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal transition-colors duration-300 hover:bg-teal hover:text-navy-950"
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function PanelHeading({
  lead,
  trail,
  flip = false,
}: {
  lead: string;
  trail: string;
  flip?: boolean;
}) {
  return (
    <h3 className="font-display text-[1.9rem] font-bold uppercase leading-[1.04] tracking-tight sm:text-[2.05rem]">
      <span className={`block ${flip ? "text-white" : "text-teal"}`}>{lead}</span>
      <span className={`block ${flip ? "text-teal" : "text-white"}`}>{trail}</span>
    </h3>
  );
}

/* ----- panel 1 : climb the ranks + live top-5 ------------------- */

function RankPanel({ top }: { top: LeaderboardRow[] }) {
  return (
    <div className={`${panelBase} bg-navy-950`}>
      <Image
        src="/media/rank-panel-bg.png"
        alt=""
        fill
        sizes="(max-width:1024px) 100vw, 33vw"
        className="object-cover object-[72%_45%] transition-transform duration-700 group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-navy-950/52" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/25 via-navy-950/60 to-navy-950/95" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-teal/10 blur-3xl" />

      <div className="relative">
        <PanelHeading lead="Play. Win." trail="Climb the ranks" flip />
        <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-mist">
          Every ranked frame moves your rating. Hold your spot, chase the one
          above you, and let the board do the talking.
        </p>
        <PanelButton href="/rankings" label="View rankings" />
      </div>

      <div className="relative mt-7 rounded-2xl glass-strong p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal">
            Top players
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">
            Points
          </span>
        </div>

        {top.length === 0 ? (
          <p className="mt-3 text-[13px] leading-relaxed text-mist">
            The board opens with the first recorded ranked match.
          </p>
        ) : (
          <ol className="mt-2">
            {top.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${p.slug}`}
                  className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0"
                >
                  <span className="flex w-5 justify-center">
                    {p.rank === 1 ? (
                      <Crown className="h-4 w-4 text-teal-bright" />
                    ) : (
                      <span className="font-display text-sm font-bold text-white/70">
                        {p.rank}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                    {p.nickname}
                  </span>
                  <span
                    className={`font-display text-sm font-bold tabular-nums ${
                      p.rank === 1 ? "text-teal-bright" : "text-white"
                    }`}
                  >
                    {p.rankingPoints.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <Link
          href="/rankings"
          className="mt-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-teal transition-colors hover:text-teal-bright"
        >
          View full leaderboard →
        </Link>
      </div>
    </div>
  );
}

/* ----- panel 2 : premium ambience (photo) ---------------------- */

function AmbiencePanel() {
  return (
    <div className={`${panelBase} justify-end`}>
      <Image
        src={cover}
        alt="Inside the Cue Point room"
        fill
        sizes="(max-width:1024px) 100vw, 33vw"
        className="scale-[1.35] object-cover object-[86%_42%] transition-transform duration-700 group-hover:scale-[1.42]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 to-navy-950/30" />
      <div className="absolute inset-0 bg-teal/8 mix-blend-color" />

      <div className="relative">
        <PanelHeading lead="Premium" trail="Ambience" />
        <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-mist">
          Low light, tournament cloth, a bar in the corner and room for a full
          stroke on every table. Built to be played in.
        </p>
        <PanelButton href="/#gallery" label="Explore the room" />
      </div>
    </div>
  );
}

/* ----- panel 3 : tournaments & events ------------------------- */

function TournamentPanel() {
  return (
    <div className={`${panelBase} justify-end bg-navy-950`}>
      <Image
        src="/media/tournament-panel-bg.png"
        alt=""
        fill
        sizes="(max-width:1024px) 100vw, 33vw"
        className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-navy-950/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/15" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-64 w-64 rounded-full bg-teal-bright/14 blur-3xl" />

      <div className="relative">
        <PanelHeading lead="Tournaments" trail="& Events" />
        <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-mist">
          Weekly ladders, handicap leagues and monthly cash tournaments on a
          live bracket. Compete. Win. Repeat.
        </p>
        <PanelButton href="/tournaments" label="View schedule" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 7.5 6.5 11 12 4l5.5 7L21 7.5 19.5 19h-15L3 7.5Z" />
    </svg>
  );
}
