import { NextRequest } from "next/server";
import * as F from "@/lib/friends/store";
import { FriendsError } from "@/lib/friends/store";
import { json, readBody, str, strList, withActor } from "@/lib/friends/http";

export const dynamic = "force-dynamic";

/** POST /api/friends/tournaments/:id/:action */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  return withActor(req, { write: true }, async (actor) => {
    const b = await readBody(req);
    switch (action) {
      case "respond":
        await F.respondToTournament(id, actor, b.accept !== false);
        break;
      case "start":
        await F.startTournament(id, actor, b.force === true);
        break;
      case "cancel":
        await F.cancelTournament(id, actor);
        break;
      case "add-team":
        await F.addTeam(id, actor, strList(b.playerIds));
        break;
      case "add-member":
        await F.addTeamMember(id, actor, str(b.teamId), str(b.playerId));
        break;
      case "remove-team":
        await F.removeTeam(id, actor, str(b.teamId));
        break;
      case "remove-member":
        await F.removeTournamentMember(id, actor, str(b.playerId));
        break;
      default:
        throw new FriendsError(404, "Unknown action");
    }
    return json({ ok: true });
  });
}
