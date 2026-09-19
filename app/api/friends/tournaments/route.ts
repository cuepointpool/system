import { NextRequest } from "next/server";
import { json, readBody, str, withActor } from "@/lib/friends/http";
import { createTournament } from "@/lib/friends/store";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withActor(req, { write: true }, async (actor) => {
    const limited = rateLimit(`fcreate:${actor.id}`, 20, 60 * 60_000);
    if (limited) return limited;
    const b = await readBody(req);
    const teams = Array.isArray(b.teams)
      ? b.teams
          .slice(0, 64)
          .map((t) =>
            Array.isArray(t) ? t.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
          )
      : [];
    const id = await createTournament(actor, {
      name: str(b.name),
      format: b.format,
      capacityTeams: b.capacityTeams,
      seeding: b.seeding,
      teams,
    });
    return json({ id }, 201);
  });
}
