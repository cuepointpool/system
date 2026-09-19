import { NextRequest } from "next/server";
import { json, withActor } from "@/lib/friends/http";
import { getTournamentView } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withActor(req, {}, async (actor) => {
    const tournament = await getTournamentView(id, actor);
    return tournament ? json({ tournament }) : json({ error: "Tournament not found" }, 404);
  });
}
