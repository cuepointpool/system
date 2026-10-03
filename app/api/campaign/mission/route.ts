import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { setObjectivesDone, startMission } from "@/lib/campaign/progress";
import { checkSupervisorCode } from "@/lib/campaign/supervisor";

export const dynamic = "force-dynamic";

/**
 * Body: { missionId, action: "start" }
 *    or { missionId, objectivesDone: number, code: string }
 *
 * Starting a mission is free. Recording progress is not: an admin who watched
 * the game enters their pass code (`code`) on the player's phone to approve
 * it. Ticking the final objective completes the mission and pays out XP +
 * coins.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    missionId?: string;
    action?: string;
    objectivesDone?: number;
    code?: string;
  } | null;

  if (!body?.missionId)
    return NextResponse.json({ error: "Missing missionId" }, { status: 422 });

  if (body.action === "start") {
    const res = await startMission(viewer.id, body.missionId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
    return NextResponse.json(res);
  }

  const check = await checkSupervisorCode(viewer.id, String(body.code ?? ""));
  if (!check.ok) {
    if (check.reason === "locked")
      return NextResponse.json(
        {
          error: `Too many wrong pass codes. Try again in ${Math.ceil((check.retryAfter ?? 60) / 60)} minutes.`,
        },
        { status: 429, headers: { "Retry-After": String(check.retryAfter ?? 60) } },
      );
    return NextResponse.json(
      {
        error:
          check.reason === "none_set"
            ? "No admin has set a campaign pass code yet. Ask at the counter."
            : "That pass code isn't right. Only an admin can approve your progress.",
      },
      { status: 403 },
    );
  }

  const res = await setObjectivesDone(
    viewer.id,
    body.missionId,
    Number(body.objectivesDone ?? 0),
    // audit trail: who approved it, and whose progress it was
    `${check.admin.slug} (approved for ${viewer.slug})`,
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json(res);
}
