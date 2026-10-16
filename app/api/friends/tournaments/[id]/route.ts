import { NextRequest } from "next/server";
import { getActor, json, withActor } from "@/lib/friends/http";
import { getTournamentView } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // official tournaments are public — watching one needs no account
  if (!(await getActor())) {
    const tournament = await getTournamentView(id, { id: "", role: "player", nickname: "" });
    return tournament?.official ? json({ tournament }) : json({ error: "Sign in to play with friends." }, 401);
  }
  return withActor(req, {}, async (actor) => {
    const tournament = await getTournamentView(id, actor);
    return tournament ? json({ tournament }) : json({ error: "Tournament not found" }, 404);
  });
}
