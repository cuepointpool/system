import { NextResponse } from "next/server";
import { listOfficialTournaments } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

/** the tournaments Cue Point hosts (public) */
export async function GET() {
  return NextResponse.json({ tournaments: await listOfficialTournaments() });
}
