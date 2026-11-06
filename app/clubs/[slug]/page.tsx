import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { JoinClubButton } from "@/components/clubs/JoinClubButton";
import { clubViewer, getClubIdBySlug, getClubView, hasRequested } from "@/lib/clubs/store";
import { getViewer } from "@/lib/ecosystem/identity";
import { formatLine } from "@/lib/friends/structure";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = await getClubIdBySlug(slug);
  if (!id) return { title: "Club not found" };
  const v = await getClubView(id);
  return {
    title: `${v.name} — weekly league at Cue Point`,
    description: `${v.name} plays a weekly group league on Cue Point: ${v.groupCount} groups, promotion and relegation every week.`,
    alternates: { canonical: `/clubs/${v.slug}` },
  };
}

const STATUS: Record<string, string> = {
  registration_open: "Not started",
  in_progress: "Being played",
  completed: "Finished",
  cancelled: "Cancelled",
};

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await getClubIdBySlug(slug);
  if (!id) notFound();
  const [v, club, viewer] = await Promise.all([getClubView(id), clubViewer(), getViewer()]);
  const isAdmin = club?.id === id;
  const current = v.weeks[0];
  const myGroup = viewer ? v.groups.find((g) => g.members.some((m) => m.id === viewer.id)) : undefined;
  const canAsk = !!viewer && viewer.role === "player" && !myGroup;
  const requested = canAsk ? await hasRequested(id, viewer!.id) : false;
  const memberCount = v.groups.reduce((n, g) => n + g.members.length, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-teal">Partner club · plays at Cue Point</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white">{v.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            A weekly league in {v.groupCount === 1 ? "one group" : `${v.groupCount} groups`} ({formatLine(v.leagueSettings)}).
            {v.groupCount > 1 && " After every week the top players move up a group and the bottom players move down."}
          </p>
          {myGroup && (
            <p className="mt-2 text-sm text-white/90">
              You&apos;re in <span className="font-semibold text-[#c4b5fd]">{myGroup.name}</span>.
            </p>
          )}
        </div>
        {isAdmin && (
          <Link href="/clubs/admin" className="btn-ghost px-4 py-2 text-sm">
            Manage club
          </Link>
        )}
      </div>

      {canAsk && <JoinClubButton slug={v.slug} clubName={v.name} requested={requested} />}
      {!viewer && !isAdmin && (
        <div className="rounded-2xl border border-[#a78bfa]/40 bg-[#a78bfa]/[0.06] p-4">
          <p className="font-semibold text-white">Want to play for {v.name}?</p>
          <p className="mt-1 text-sm text-mist">
            Sign in to your Cue Point account (or register — it&apos;s free), then ask to join.
          </p>
          <Link
            href={`/account?next=${encodeURIComponent(`/clubs/${v.slug}`)}`}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-5 text-sm font-bold text-white"
          >
            Sign in to join
          </Link>
        </div>
      )}

      {current && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="font-display text-xl font-bold text-white">
            Week {current.week} {current.done ? "· finished" : "· this week"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${v.slug}/tournaments/${t.id}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-[#a78bfa]/50"
              >
                <span className="block font-semibold text-white">{t.groupName}</span>
                <span className="text-xs text-mist">
                  {t.players} players · {STATUS[t.status] ?? t.status}
                  {t.champion ? ` · 🏆 ${t.champion}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-bold text-white">
          Members <span className="text-base font-normal text-mist">({memberCount})</span>
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {v.groups.map((g) => (
            <div key={g.group} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="flex items-baseline justify-between">
                <span className="font-display text-lg font-semibold text-white">
                  {g.group === 1 ? "★ " : ""}
                  {g.name}
                </span>
                <span className="text-xs text-mist">{g.members.length} players</span>
              </p>
              <ul className="mt-3 space-y-2">
                {g.members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/players/${m.slug}`} className="flex items-center gap-2 text-sm text-white/90 hover:text-white">
                      <PlayerAvatar name={m.nickname} src={m.avatar} size="xs" />
                      {m.nickname}
                      {viewer?.id === m.id && <span className="text-[11px] text-mist">(you)</span>}
                    </Link>
                  </li>
                ))}
                {!g.members.length && <li className="text-sm text-mist">No players yet.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {v.weeks.length > 1 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="font-display text-xl font-bold text-white">Past weeks</h2>
          <ul className="mt-3 space-y-3">
            {v.weeks.slice(1).map((w) => (
              <li key={w.week}>
                <p className="text-sm font-semibold text-white">Week {w.week}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {w.tournaments.map((t) => (
                    <Link
                      key={t.id}
                      href={`/clubs/${v.slug}/tournaments/${t.id}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/90 hover:border-[#a78bfa]/50"
                    >
                      {t.groupName}
                      {t.status === "cancelled" ? " · cancelled" : t.champion ? ` · 🏆 ${t.champion}` : ""}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
