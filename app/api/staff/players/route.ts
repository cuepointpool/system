import { NextRequest, NextResponse } from "next/server";
import { adminActor, staffActor } from "@/lib/ecosystem/identity";
import { syncPlayerMonthPoints } from "@/lib/ecosystem/loyalty-sync";
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
  const isAdmin = !!(await adminActor(req));
  if (!isAdmin && body.membershipTier && body.membershipTier !== "basic")
    return NextResponse.json(
      { error: "Only an admin can put a player on a paid membership." },
      { status: 403 },
    );
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
  if (
    (body.membershipTier !== undefined || body.role !== undefined) &&
    !(await adminActor(req))
  )
    return NextResponse.json(
      { error: "Only an admin can change a player's membership or role." },
      { status: 403 },
    );
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
  if (body.membershipTier !== undefined) {
    // table time already paid for today now earns at the new plan's rate
    const month = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    await syncPlayerMonthPoints(String(body.id), month).catch((e) =>
      console.error("[loyalty] sync after membership change failed", e),
    );
  }
  return NextResponse.json({ ok: true, player: updated });
}
