import { NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import {
  derivedTournamentStatus,
  getTournamentBySlug,
  isRegistered,
  registerForTournament,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getViewer();
  return NextResponse.json({
    tournament: { ...t, status: derivedTournamentStatus(t) },
    spotsLeft: tournamentSpotsLeft(t),
    registered: await isRegistered(slug, viewer?.id ?? null),
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to register for tournaments" },
      { status: 401 },
    );
  }
  const res = await registerForTournament(slug, viewer.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({
    ok: true,
    registered: true,
    registeredCount: res.tournament!.registrations.filter((r) => r.playerId).length,
  });
}
