import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { PlayerAvatar, SectionHeader, SkillTag } from "./Primitives";
import {
  derivedTournamentStatus,
  getLeaderboard,
  getPromotions,
  getTournaments,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";
import type { Tournament, TournamentStatus } from "@/lib/ecosystem/types";
import { formatDateShort } from "@/lib/utils";

const MEDAL: Record<number, string> = {
  1: "bg-[#d9b46a] text-navy-950",
  2: "bg-[#c3cad3] text-navy-950",
  3: "bg-[#cd7f4d] text-navy-950",
};

const PERKS = [
  { icon: "trend", t: "Real rankings", d: "Updated in real time" },
  { icon: "shield", t: "Fair play", d: "Verified matches" },
  { icon: "star", t: "Skill recognition", d: "Rise to the top" },
  { icon: "gift", t: "Exclusive rewards", d: "For top performers" },
] as const;

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
      return "Upcoming tournament";
  }
}

function monthDay(iso: string) {
  const d = new Date(iso);
  return {
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

/* The competitive scene — leaderboard + tournament news */
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
    <section className="relative isolate overflow-hidden bg-navy-950 py-20 sm:py-28 md:py-32">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/media/king-table.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-[0.6]"
        />
        <div className="absolute inset-0 bg-navy-950/64" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-950/55 to-navy-950" />
        <div className="pointer-events-none absolute left-1/2 top-8 h-[380px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-full bg-teal/8 blur-[140px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 md:px-8 lg:grid-cols-2">
        {/* ============ LEFT — leaderboard ============ */}
        <Reveal className="h-full">
          <div className="flex h-full flex-col rounded-[26px] border border-white/[0.06] bg-navy-900/55 p-6 backdrop-blur-md sm:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal">
              Compete. Rank. Win.
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-4xl">
              <span className="block text-white">Cue Point</span>
              <span className="block text-teal-gradient">Leaderboard</span>
            </h2>
            <span className="mt-4 flex items-center gap-2">
              <span className="h-px w-14 bg-gradient-to-r from-teal to-transparent" />
              <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_10px_2px_rgba(0,194,168,0.6)]" />
            </span>
            <p className="mt-3 text-sm text-mist">Where skills meet recognition.</p>

            {top.length === 0 ? (
              <p className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-[13px] text-mist">
                The board opens with the first recorded ranked match.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto hide-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.14em] text-mist/70">
                      <th className="pb-3 pr-2 font-semibold">#</th>
                      <th className="pb-3 pr-2 font-semibold">Player</th>
                      <th className="hidden pb-3 pr-2 text-right font-semibold md:table-cell">
                        Matches
                      </th>
                      <th className="hidden pb-3 pr-2 text-right font-semibold md:table-cell">
                        Wins
                      </th>
                      <th className="pb-3 pr-2 text-right font-semibold">Win %</th>
                      <th className="pb-3 text-right font-semibold">Rank pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-white/[0.05] align-middle"
                      >
                        <td className="py-3 pr-2">
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full font-display text-xs font-bold ${
                              MEDAL[p.rank] ?? "bg-white/8 text-white/80"
                            }`}
                          >
                            {p.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <Link
                            href={`/players/${p.slug}`}
                            className="flex items-center gap-2.5"
                          >
                            <PlayerAvatar
                              name={p.fullName}
                              src={p.avatar}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-white">
                                {p.fullName}
                              </span>
                              <span className="block text-[11px] text-mist">
                                {p.skillLevel}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden py-3 pr-2 text-right tabular-nums text-white/85 md:table-cell">
                          {p.matchesPlayed}
                        </td>
                        <td className="hidden py-3 pr-2 text-right tabular-nums text-white/85 md:table-cell">
                          {p.wins}
                        </td>
                        <td className="py-3 pr-2 text-right tabular-nums text-white/85">
                          {p.winPct}%
                        </td>
                        <td className="py-3 text-right font-display font-bold tabular-nums text-teal-bright">
                          {p.rankingPoints.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Link
              href="/rankings"
              className="mt-6 inline-flex w-fit items-center gap-2 self-center rounded-full border border-teal/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal transition-colors hover:bg-teal hover:text-navy-950"
            >
              View full leaderboard
              <span aria-hidden>&rarr;</span>
            </Link>

            <ul className="mt-auto grid grid-cols-2 gap-5 border-t border-white/[0.05] pt-6 sm:grid-cols-4 sm:gap-3">
              {PERKS.map((perk) => (
                <li
                  key={perk.t}
                  className="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left"
                >
                  <span className="text-teal">
                    <SceneIcon name={perk.icon} />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-teal">
                    {perk.t}
                  </span>
                  <span className="text-[11px] leading-tight text-mist">
                    {perk.d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* ============ RIGHT — tournament news ============ */}
        <Reveal delay={0.08} className="h-full">
          <div className="flex h-full flex-col rounded-[26px] border border-white/[0.06] bg-navy-900/55 p-6 backdrop-blur-md sm:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal">
              Join. Compete. Champion.
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-4xl">
              <span className="block text-white">Tournament</span>
              <span className="block text-teal-gradient">News</span>
            </h2>
            <span className="mt-4 flex items-center gap-2">
              <span className="h-px w-14 bg-gradient-to-r from-teal to-transparent" />
              <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_10px_2px_rgba(0,194,168,0.6)]" />
            </span>
            <p className="mt-3 text-sm text-mist">Big matches. Bigger moments.</p>

            {!featured ? (
              <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-[13px] text-mist">
                No tournaments scheduled yet — check back soon.
              </div>
            ) : (
              <>
                <FeaturedTournament t={featured} />
                {more.length > 0 && (
                  <div className="mt-5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                      More tournaments
                    </span>
                    <ul className="mt-3 space-y-2">
                      {more.map((t) => {
                        const { mon, day } = monthDay(t.startAt);
                        return (
                          <li key={t.id}>
                            <Link
                              href={`/tournaments/${t.slug}`}
                              className="flex items-center gap-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition-colors hover:border-teal/25"
                            >
                              <span className="grid shrink-0 place-items-center rounded-lg bg-navy-900 px-2.5 py-1.5 text-center">
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-teal">
                                  {mon}
                                </span>
                                <span className="block font-display text-base font-bold leading-none text-white">
                                  {day}
                                </span>
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white">
                                  {t.name}
                                </span>
                                <span className="block text-[11px] text-mist">
                                  {formatDateShort(t.startAt)}
                                </span>
                              </span>
                              <span aria-hidden className="text-mist">
                                <SceneIcon name="chevron" />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <Link
                  href="/tournaments"
                  className="mt-5 inline-flex w-fit items-center gap-2 self-center rounded-full border border-teal/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal transition-colors hover:bg-teal hover:text-navy-950"
                >
                  View all tournaments
                  <span aria-hidden>&rarr;</span>
                </Link>
              </>
            )}
          </div>
        </Reveal>
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
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-navy-900/50 p-5 sm:p-6">
      <span className="inline-flex rounded-full bg-teal/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal">
        {statusLabel(t.status)}
      </span>
      <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white">
        {t.name}
      </h3>

      <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-mist">
        <span className="flex items-center gap-2">
          <span className="text-teal">
            <SceneIcon name="calendar" />
          </span>
          {formatDateShort(t.startAt)}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-teal">
            <SceneIcon name="pin" />
          </span>
          {t.venue}
        </span>
      </div>

      {t.rules.length > 0 && (
        <>
          <span className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
            Event highlights
          </span>
          <ul className="mt-2 space-y-1.5">
            {t.rules.slice(0, 4).map((r) => (
              <li key={r} className="flex items-center gap-2 text-[13px] text-white/85">
                <span className="text-teal">
                  <SceneIcon name="check" />
                </span>
                {r}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/tournaments/${t.slug}`}
          className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-950 transition-colors hover:bg-teal-bright"
        >
          {t.status === "registration_open" ? "Register now" : "View tournament"}
          <span aria-hidden>&rarr;</span>
        </Link>
        {t.status === "registration_open" && spots > 0 && (
          <span className="text-[11px] text-mist">{spots} spots left</span>
        )}
      </div>
    </div>
  );
}

function SceneIcon({ name }: { name: string }) {
  const p = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "trend":
      return (
        <svg {...p}>
          <path d="M3 17l6-6 4 4 7-7" />
          <path d="M17 5h4v4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p}>
          <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="M12 3l2.6 5.6L21 9.3l-4.5 4.2 1.1 6.1L12 16.8 6.4 19.6l1.1-6.1L3 9.3l6.4-.7z" />
        </svg>
      );
    case "gift":
      return (
        <svg {...p}>
          <rect x="4" y="9" width="16" height="12" rx="1.5" />
          <path d="M4 13h16M12 9v12M12 9S9 3 6.5 5.5 12 9 12 9zM12 9s3-6 5.5-3.5S12 9 12 9z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" />
        </svg>
      );
    case "pin":
      return (
        <svg {...p}>
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="M4 12.5l4.5 4.5L20 6" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
  }
}

/* Offers · Community · SL directory teaser */
export async function HomeOffersCommunity() {
  const [promotions, monthly] = await Promise.all([
    getPromotions({}),
    getLeaderboard("all_time"),
  ]);
  const offers = promotions.filter((p) => p.state === "active").slice(0, 3);
  const players = monthly.slice(0, 6);
  if (offers.length === 0 && players.length === 0) return null;

  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        {offers.length > 0 && (
          <Reveal>
            <div className="flex items-end justify-between">
              <SectionHeader kicker="On now" title="Current offers" />
              <Link
                href="/offers"
                className="whitespace-nowrap text-xs font-medium text-mist transition-colors hover:text-white"
              >
                See all offers →
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <Link
                  key={o.id}
                  href="/offers"
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-teal/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal">
                      Active
                    </span>
                    <span className="font-display text-sm font-bold text-teal-bright">
                      {o.discount}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold text-white">
                    {o.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] text-mist">
                    {o.description}
                  </p>
                  <p className="mt-3 text-[11px] text-mist/60">
                    Until {formatDateShort(o.endAt)}
                  </p>
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        {players.length > 0 && (
        <Reveal delay={0.05}>
          <div className="mt-16 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeader kicker="Cue Point community" title="Meet the players" />
              <Link
                href="/players"
                className="text-xs font-medium text-mist transition-colors hover:text-white"
              >
                Explore players →
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {players.map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.slug}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-teal/30"
                >
                  <PlayerAvatar
                    name={p.fullName}
                    src={p.avatar}
                    size="md"
                    className="mx-auto"
                  />
                  <div className="mt-2 truncate text-[13px] font-semibold text-white">
                    {p.nickname}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <SkillTag level={p.skillLevel} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-mist">
                    #{p.rank} · {p.winPct}%
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
        )}

        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-white/[0.08] bg-[linear-gradient(120deg,rgba(0,194,168,0.06),transparent)] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <span className="text-xs uppercase tracking-[0.28em] text-teal">
                Coming soon
              </span>
              <h3 className="mt-2 font-display text-xl font-bold text-white sm:text-2xl">
                Explore Pool in Sri Lanka
              </h3>
              <p className="mt-1.5 max-w-lg text-sm text-mist">
                A directory of pool &amp; billiards venues across the island —
                tables, rates, tournaments and online booking. Cue Point is
                venue #1.
              </p>
            </div>
            <span className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-mist">
              In development
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
