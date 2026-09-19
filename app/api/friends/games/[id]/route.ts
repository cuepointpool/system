import { NextRequest } from "next/server";
import { json, withActor } from "@/lib/friends/http";
import { getGameView } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withActor(req, {}, async (actor) => {
    const game = await getGameView(id, actor);
    // not added to it → it doesn't exist as far as you're concerned
    return game ? json({ game }) : json({ error: "Game not found" }, 404);
  });
}
