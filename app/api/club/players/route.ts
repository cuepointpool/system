import { NextResponse } from "next/server";
import { clubViewer, listCuePointPlayers } from "@/lib/clubs/store";

export const dynamic = "force-dynamic";

/** every registered Cue Point player (name + handle only, never email) — club admin only */
export async function GET() {
  const club = await clubViewer();
  if (!club) return NextResponse.json({ error: "Sign in as the club admin first." }, { status: 401 });
  return NextResponse.json(
    { players: await listCuePointPlayers(club.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
