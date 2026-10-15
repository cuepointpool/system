import { NextRequest } from "next/server";
import * as F from "@/lib/friends/store";
import { FriendsError } from "@/lib/friends/store";
import { json, readBody, str, withActor } from "@/lib/friends/http";

export const dynamic = "force-dynamic";

/** { scoreA, scoreB } from the body — frames won by side A and side B */
function score(b: Record<string, unknown>): { a: number; b: number } | null {
  if (b.scoreA === undefined || b.scoreB === undefined) return null;
  return { a: Math.trunc(Number(b.scoreA)), b: Math.trunc(Number(b.scoreB)) };
}

/** POST /api/friends/games/:id/:action — every state change goes through here */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  return withActor(req, { write: true }, async (actor) => {
    const b = await readBody(req);
    switch (action) {
      case "respond":
        await F.respondToGame(id, actor, b.accept !== false);
        break;
      case "start":
        await F.startGame(id, actor, typeof b.tableName === "string" ? b.tableName : null);
        break;
      case "report":
        await F.reportResult(id, actor, str(b.winnerTeamId), score(b));
        break;
      case "confirm":
        await F.confirmResult(id, actor);
        break;
      case "dispute":
        await F.disputeResult(id, actor);
        break;
      case "undo":
        await F.undoResult(id, actor);
        break;
      case "settle":
        await F.settleResult(id, actor, str(b.winnerTeamId), score(b));
        break;
      case "cancel":
        await F.cancelGame(id, actor);
        break;
      case "add-player":
        await F.addPlayerToGame(id, actor, str(b.playerId), str(b.teamId) || undefined);
        break;
      case "remove-player":
        await F.removePlayerFromGame(id, actor, str(b.playerId));
        break;
      default:
        throw new FriendsError(404, "Unknown action");
    }
    return json({ ok: true });
  });
}
