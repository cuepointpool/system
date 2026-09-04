import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { setObjectivesDone, startMission } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

/**
 * Body: { missionId, action: "start" }
 *    or { missionId, objectivesDone: number }
 *
 * Ticking the final objective completes the mission and pays out XP + coins.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    missionId?: string;
    action?: string;
    objectivesDone?: number;
  } | null;

  if (!body?.missionId)
    return NextResponse.json({ error: "Missing missionId" }, { status: 422 });

  const res =
    body.action === "start"
      ? await startMission(viewer.id, body.missionId)
      : await setObjectivesDone(
          viewer.id,
          body.missionId,
          Number(body.objectivesDone ?? 0),
          viewer.slug,
        );

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json(res);
}
