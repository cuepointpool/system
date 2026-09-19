import { NextRequest } from "next/server";
import { json, withActor } from "@/lib/friends/http";
import { searchPlayers } from "@/lib/friends/store";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** find registered players to add — nickname / handle only, never email */
export async function GET(req: NextRequest) {
  return withActor(req, {}, async (actor) => {
    const limited = rateLimit(`fsearch:${actor.id}`, 60, 60_000);
    if (limited) return limited;
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return json({ players: await searchPlayers(actor, q) });
  });
}
