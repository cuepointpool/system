import { NextResponse } from "next/server";
import { clubViewer, getClubView } from "@/lib/clubs/store";

export const dynamic = "force-dynamic";

/** the signed-in club admin's club, with groups, weeks and pending moves */
export async function GET() {
  const club = await clubViewer();
  if (!club) return NextResponse.json({ club: null }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      club: { name: club.name, slug: club.slug, username: club.username, hostId: club.hostId },
      view: await getClubView(club.id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
