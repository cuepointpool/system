import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import { adjustLoyalty } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "");
  const points = Number(body.points);
  const reason = String(body.reason ?? "").trim();
  if (!playerId || !Number.isFinite(points) || points === 0 || !reason)
    return NextResponse.json(
      { error: "playerId, a non-zero points value and a reason are required" },
      { status: 422 },
    );
  const tx = await adjustLoyalty(playerId, points, reason, actor);
  return NextResponse.json({ ok: true, transaction: tx }, { status: 201 });
}
