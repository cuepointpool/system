import { NextRequest, NextResponse } from "next/server";
import {
  addMember,
  ClubError,
  clubViewer,
  getClubView,
  moveMember,
  removeMember,
  startWeek,
  swapMembers,
  undoLastMoves,
  updateClubSettings,
} from "@/lib/clubs/store";
import { audit } from "@/lib/ecosystem/store";
import { FriendsError } from "@/lib/friends/store";
import { rateLimit, tooLarge } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** POST /api/club/manage { action, ... } — signed-in club admin only */
export async function POST(req: NextRequest) {
  const club = await clubViewer();
  if (!club) return json({ error: "Sign in as the club admin first." }, 401);
  const big = tooLarge(req, 16_384);
  if (big) return big;
  const limited = rateLimit(`club:${club.id}`, 120, 60_000);
  if (limited) return limited;

  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const action = str(b.action);
  try {
    let detail = "";
    switch (action) {
      case "add-member":
        await addMember(club.id, str(b.playerId), b.group);
        detail = `${str(b.playerId)} → group ${b.group}`;
        break;
      case "move-member":
        await moveMember(club.id, str(b.playerId), b.group);
        detail = `${str(b.playerId)} → group ${b.group}`;
        break;
      case "remove-member":
        await removeMember(club.id, str(b.playerId));
        detail = str(b.playerId);
        break;
      case "settings":
        await updateClubSettings(club.id, {
          groupCount: b.groupCount,
          groupNames: b.groupNames,
          moveCount: b.moveCount,
          leagueSettings: b.leagueSettings,
        });
        break;
      case "swap-members":
        await swapMembers(club.id, str(b.a), str(b.b));
        detail = `${str(b.a)} <> ${str(b.b)}`;
        break;
      case "undo-moves":
        detail = `${await undoLastMoves(club.id)} moved back`;
        break;
      case "start-week":
        detail = (await startWeek(club.id)).join(",");
        break;
      default:
        return json({ error: "Unknown action" }, 404);
    }
    await audit(`club:${club.username}`, `club.${action}`, "club", club.id, detail);
    return json({ ok: true, view: await getClubView(club.id) });
  } catch (err) {
    if (err instanceof ClubError || err instanceof FriendsError) return json({ error: err.message }, err.status);
    console.error("[club] unexpected error", err);
    return json({ error: "Something went wrong." }, 500);
  }
}
