import { NextResponse } from "next/server";
import {
  derivedTournamentStatus,
  getTournaments,
  tournamentSpotsLeft,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const tournaments = (await getTournaments()).map((t) => ({
    ...t,
    status: derivedTournamentStatus(t),
    spotsLeft: tournamentSpotsLeft(t),
    registeredCount: t.registrations.filter((r) => r.playerId).length,
  }));
  return NextResponse.json({ tournaments });
}
