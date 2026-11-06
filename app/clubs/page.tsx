import type { Metadata } from "next";
import Link from "next/link";
import { listPublicClubs } from "@/lib/clubs/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner clubs",
  description: "Pool clubs that run their weekly group leagues at Cue Point, Pitipana, Homagama.",
  alternates: { canonical: "/clubs" },
};

export default async function ClubsPage() {
  const clubs = await listPublicClubs();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 pb-28 pt-28 md:px-8 sm:pt-32">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-teal">Play at Cue Point</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-white">Partner clubs</h1>
        <p className="mt-2 max-w-2xl text-sm text-mist">
          Clubs that run their own weekly group leagues on Cue Point. Every club player has a Cue Point account, so
          their club results count on the in-house rankings too.
        </p>
      </div>
      {clubs.length === 0 ? (
        <p className="text-sm text-mist">No partner clubs yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link
              key={c.slug}
              href={`/clubs/${c.slug}`}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-colors hover:border-[#a78bfa]/50"
            >
              <p className="font-display text-xl font-semibold text-white">{c.name}</p>
              <p className="mt-1 text-sm text-mist">
                {c.members} player{c.members === 1 ? "" : "s"} · {c.groups} group{c.groups === 1 ? "" : "s"}
                {c.week ? ` · week ${c.week}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
      <p className="text-sm text-mist">
        Club admin?{" "}
        <Link href="/clubs/admin" className="underline">
          Sign in here
        </Link>
        .
      </p>
    </div>
  );
}
