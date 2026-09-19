import { NextRequest } from "next/server";
import { json, withActor } from "@/lib/friends/http";
import { listMyPlay } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

/** everything the "Play" hub shows: my games, my tournaments, invitations, points */
export async function GET(req: NextRequest) {
  return withActor(req, {}, async (actor) => json(await listMyPlay(actor)));
}
