import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/eco/Primitives";
import { PlayHub } from "@/components/friends/PlayHub";
import { requirePlayer } from "@/lib/friends/page";
import { listMyPlay } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Play with friends",
  description: "Create 8-Ball games and tournaments with your friends at Cue Point.",
  robots: { index: false, follow: false },
};

const TABS = ["games", "tournaments", "invitations", "notifications"] as const;

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { actor } = await requirePlayer("/play");
  const { tab } = await searchParams;
  const initial = await listMyPlay(actor);
  const initialTab = TABS.find((t) => t === tab) ?? "games";

  return (
    <>
      <PageHero
        kicker="Friends"
        title={
          <>
            Play with <span className="bg-[linear-gradient(120deg,#a78bfa,#ec4899)] bg-clip-text text-transparent">friends</span>
          </>
        }
        intro="Set up an 8-Ball game or a whole tournament, add your friends, and everyone sees it live in their account."
        actions={
          <>
            <Link
              href="/play/new-game"
              className="rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-6 py-3 text-sm font-semibold text-navy-950"
            >
              New game
            </Link>
            <Link
              href="/play/new-tournament"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:border-[#a78bfa]/60"
            >
              New tournament
            </Link>
          </>
        }
      />
      <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
        <PlayHub initial={initial} initialTab={initialTab} />
      </div>
    </>
  );
}
