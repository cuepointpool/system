import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { PlayerAvatar } from "./Primitives";
import {
  derivedTournamentStatus,
  getLeaderboard,
  getPromotions,
  getTournaments,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";
import type { Tournament, TournamentStatus } from "@/lib/ecosystem/types";
import { formatDateShort } from "@/lib/utils";
import { SectionKicker } from "@/components/BrandMark";

const MEDAL: Record<number, string> = {
  1: "bg-[#d9b46a] text-navy-950",
  2: "bg-[#c3cad3] text-navy-950",
  3: "bg-[#cd7f4d] text-navy-950",
};

function statusLabel(s: TournamentStatus) {
  switch (s) {
    case "registration_open":
      return "Registration open";
    case "live":
      return "Live now";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Upcoming";
  }
}

function monthDay(iso: string) {
  const d = new Date(iso);
  return {
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

/* The competitive scene — leaderboard + tournaments */
export async function HomeScene() {
  const [leaderboard, allTournaments] = await Promise.all([
    getLeaderboard("all_time"),
    getTournaments(),
  ]);
  const top = leaderboard.slice(0, 5);
  const tournaments = allTournaments
    .map((t) => ({ ...t, status: derivedTournamentStatus(t) }))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const featured =
    tournaments.find((t) => t.status === "registration_open") ??
    tournaments.find((t) => t.status === "live") ??
    tournaments.find((t) => t.status === "upcoming") ??
    tournaments[0];
  const more = tournaments.filter((t) => t.id !== featured?.id).slice(0, 3);

  return (
    <section className="bg-navy-950 py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <SectionKicker>
            Rankings and tournaments
          </SectionKicker>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap">
              Who is on top right now
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              Ranked matches played at Cue Point feed the board. Tournaments are
              listed here as soon as they are announced.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-[1.25fr_1fr]">
          {/* ============ leaderboard ============ */}
          <Reveal>
            <div className="flex items-baseline justify-between border-b border-white/15 pb-4">
              <h3 className="font-display text-2xl font-bold text-gold">Leaderboard</h3>
              <Link
                href="/rankings"
                className="text-[12px] font-bold uppercase tracking-[0.08em] text-white underline decoration-white/40 underline-offset-4 hover:text-gold hover:decoration-gold"
              >
                Full leaderboard
              </Link>
            </div>

            {top.length === 0 ? (
              <p className="py-8 text-[15px] text-mist">
                The board opens with the first recorded ranked match.
              </p>
            ) : (
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="text-xs text-mist">
                    <th className="w-10 py-3 pr-2 font-medium">#</th>
                    <th className="py-3 pr-2 font-medium">Player</th>
                    <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">Matches</th>
                    <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">Wins</th>
                    <th className="py-3 pr-4 text-right font-medium">Win %</th>
                    <th className="py-3 text-right font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((p) => (
                    <tr key={p.id} className="border-t border-white/10 align-middle">
                      <td className="py-4 pr-2">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-full font-display text-sm font-bold ${
                            MEDAL[p.rank] ?? "bg-white/10 text-white"
                          }`}
                        >
                          {p.rank}
                        </span>
                      </td>
                      <td className="py-4 pr-2">
                        <Link href={`/players/${p.slug}`} className="flex items-center gap-3 hover:underline">
                          <PlayerAvatar name={p.fullName} src={p.avatar} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-white">{p.fullName}</span>
                            <span className="block text-xs text-mist">{p.skillLevel}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden py-4 pr-4 text-right tabular-nums text-white/85 sm:table-cell">
                        {p.matchesPlayed}
                      </td>
                      <td className="hidden py-4 pr-4 text-right tabular-nums text-white/85 sm:table-cell">
                        {p.wins}
                      </td>
                      <td className="py-4 pr-4 text-right tabular-nums text-white/85">{p.winPct}%</td>
                      <td className="py-4 text-right font-display font-bold tabular-nums text-white">
                        {p.rankingPoints.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {top.length > 0 && top.length < 5 && (
              <p className="border-t border-white/10 pt-4 text-sm text-mist">
                The board is just getting started. Play a ranked match and your
                name goes on it.
              </p>
            )}
          </Reveal>

          {/* ============ tournaments ============ */}
          <Reveal delay={0.08}>
            <div className="flex items-baseline justify-between border-b border-white/15 pb-4">
              <h3 className="font-display text-2xl font-bold text-gold">Tournaments</h3>
              <Link
                href="/tournaments"
                className="text-[12px] font-bold uppercase tracking-[0.08em] text-white underline decoration-white/40 underline-offset-4 hover:text-gold hover:decoration-gold"
              >
                All tournaments
              </Link>
            </div>

            <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-lg bg-navy-900">
              <Image
                src="/media/story/scene.jpg"
                alt="A player lining up a shot"
                fill
                sizes="(max-width:1024px) 100vw, 42vw"
                className="object-cover"
              />
            </div>

            {!featured ? (
              <div className="mt-5">
                <p className="font-display text-xl font-bold text-white">
                  No tournaments scheduled yet
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/85">
                  House tournaments will be listed here when they are announced.
                  Until then you can run one yourself with friends.
                </p>
                <Link
                  href="/play/new-tournament"
                  className="mt-5 inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
                >
                  Create a friends tournament
                </Link>
              </div>
            ) : (
              <>
                <FeaturedTournament t={featured} />
                {more.length > 0 && (
                  <ul className="mt-6 border-t border-white/10">
                    {more.map((t) => {
                      const { mon, day } = monthDay(t.startAt);
                      return (
                        <li key={t.id} className="border-b border-white/10">
                          <Link
                            href={`/tournaments/${t.slug}`}
                            className="flex items-center gap-4 py-3.5 hover:underline"
                          >
                            <span className="w-12 shrink-0 text-center">
                              <span className="block text-[11px] font-semibold uppercase text-teal">{mon}</span>
                              <span className="block font-display text-xl font-bold leading-none text-white">
                                {day}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
                              {t.name}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeaturedTournament({
  t,
}: {
  t: Tournament & { status: TournamentStatus };
}) {
  const spots = tournamentSpotsLeft(t);
  return (
    <div className="mt-5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
        {statusLabel(t.status)}
      </span>
      <h4 className="mt-1.5 font-display text-2xl font-bold leading-tight text-white">
        {t.name}
      </h4>
      <p className="mt-2 text-[15px] text-white/85">
        {formatDateShort(t.startAt)} · {t.venue}
      </p>

      {t.rules.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-white/85 marker:text-teal">
          {t.rules.slice(0, 4).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          href={`/tournaments/${t.slug}`}
          className="inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
        >
          {t.status === "registration_open" ? "Register now" : "View tournament"}
        </Link>
        {t.status === "registration_open" && spots > 0 && (
          <span className="text-sm text-mist">{spots} spots left</span>
        )}
      </div>
    </div>
  );
}

/* Offers · Community · SL directory teaser */
export async function HomeOffersCommunity() {
  const [promotions, monthly] = await Promise.all([
    getPromotions({}),
    getLeaderboard("all_time"),
  ]);
  const offers = promotions.filter((p) => p.state === "active").slice(0, 3);
  const players = monthly.slice(0, 5);
  if (offers.length === 0 && players.length === 0) return null;

  const headLink =
    "whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.08em] text-white underline decoration-white/40 underline-offset-4 hover:text-gold hover:decoration-gold";

  return (
    <section className="py-20 sm:py-28">
      <div className="space-y-16 px-5 md:px-8 lg:px-12">
        {offers.length > 0 && (
          <Reveal>
            <div className="flex items-baseline justify-between gap-4 border-b border-white/15 pb-4">
              <h2 className="font-display text-2xl font-bold text-gold">Current offers</h2>
              <Link href="/offers" className={headLink}>
                All offers
              </Link>
            </div>
            <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <Link key={o.id} href="/offers" className="group block">
                  <span className="font-display text-3xl font-bold text-white">
                    {o.discount}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-bold text-white group-hover:underline">
                    {o.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-white/85">
                    {o.description}
                  </p>
                  <p className="mt-2 text-sm text-mist">
                    Until {formatDateShort(o.endAt)}
                  </p>
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        {players.length > 0 && (
          <Reveal delay={0.05}>
            <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-navy-900 lg:aspect-[3/2]">
                <Image
                  src="/media/story/players.jpg"
                  alt="A smiling player lining up a shot"
                  fill
                  sizes="(max-width:1024px) 100vw, 55vw"
                  className="object-cover object-[60%_40%]"
                />
              </div>

              <div>
                <SectionKicker>
                  The Cue Point community
                </SectionKicker>
                <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
                  Meet the players
                </h2>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/85">
                  Every member gets a player profile with their rank, results
                  and match history. Joining is free, and your name goes on the
                  list as soon as you sign up.
                </p>

                <ul className="mt-7 border-t border-white/15">
                  {players.map((p) => (
                    <li key={p.id} className="border-b border-white/10">
                      <Link
                        href={`/players/${p.slug}`}
                        className="group flex items-center gap-3 py-3"
                      >
                        <span className="w-7 shrink-0 font-display text-lg font-bold text-gold">
                          {p.rank}
                        </span>
                        <PlayerAvatar name={p.fullName} src={p.avatar} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-white group-hover:underline">
                            {p.nickname}
                          </span>
                          <span className="block text-xs text-mist">{p.skillLevel}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums text-white/85">
                          {p.rankingPoints.toLocaleString()} pts
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {players.length < 3 && (
                  <p className="mt-3 text-sm text-mist">
                    The list is just getting started. Be one of the first names on it.
                  </p>
                )}

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/account"
                    className="inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
                  >
                    Join free
                  </Link>
                  <Link
                    href="/players"
                    className="inline-flex items-center rounded-full border border-white/60 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-navy-950"
                  >
                    All players
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
