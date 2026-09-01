import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  computeStats,
  createPlayerByStaff,
  getPlayers,
  getRankingHistory,
  toPlayerLite,
  updatePlayer,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const historyFor = new URL(req.url).searchParams.get("history");
  const [players, { stats }] = await Promise.all([
    getPlayers({ includeStaff: true }),
    computeStats(),
  ]);

  return NextResponse.json({
    players: players.map((p) => ({
      ...toPlayerLite(p, stats.get(p.id)?.rank ?? 0),
      email: p.email,
      role: p.role,
      matchesPlayed: stats.get(p.id)?.matchesPlayed ?? 0,
      rankingPoints: stats.get(p.id)?.rankingPoints ?? 0,
      membershipStatus: p.membershipStatus,
    })),
    history: historyFor ? await getRankingHistory(historyFor) : null,
  });
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!String(body.fullName ?? "").trim() || !String(body.nickname ?? "").trim())
    return NextResponse.json({ error: "Name and player name required" }, { status: 422 });
  const player = await createPlayerByStaff(
    {
      fullName: String(body.fullName),
      nickname: String(body.nickname),
      skillLevel: body.skillLevel,
      membershipTier: body.membershipTier,
      homeTable: body.homeTable ?? null,
      email: body.email ?? null,
    },
    actor,
  );
  return NextResponse.json({ ok: true, player }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  const updated = await updatePlayer(
    body.id,
    {
      skillLevel: body.skillLevel,
      membershipTier: body.membershipTier,
      role: body.role,
      bio: body.bio,
      homeTable: body.homeTable,
      fullName: body.fullName,
    },
    actor,
  );
  return NextResponse.json({ ok: true, player: updated });
}
