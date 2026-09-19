import { NextRequest } from "next/server";
import { json, readBody, str, strList, withActor } from "@/lib/friends/http";
import { createGame } from "@/lib/friends/store";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withActor(req, { write: true }, async (actor) => {
    const limited = rateLimit(`fcreate:${actor.id}`, 20, 60 * 60_000);
    if (limited) return limited;
    const b = await readBody(req);
    const id = await createGame(actor, {
      name: str(b.name),
      format: b.format,
      teamA: strList(b.teamA),
      teamB: strList(b.teamB),
    });
    return json({ id }, 201);
  });
}
