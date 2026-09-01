import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import { getAudit, getMatches, recordMatch } from "@/lib/ecosystem/store";
import type { RecordMatchInput } from "@/lib/ecosystem/store";
import type { MatchType } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

const TYPES: MatchType[] = ["casual", "ranked", "tournament"];

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const [matches, audit] = await Promise.all([
    getMatches({ limit: 40 }),
    getAudit(),
  ]);
  return NextResponse.json({ matches, audit: audit.slice(0, 40) });
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor)
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<RecordMatchInput> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!body.type || !TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Pick a match type" }, { status: 422 });
  }
  const required: (keyof RecordMatchInput)[] = [
    "playerAId",
    "playerBId",
    "winnerId",
    "tableName",
  ];
  for (const k of required) {
    if (!body[k]) {
      return NextResponse.json({ error: `Missing ${k}` }, { status: 422 });
    }
  }

  const res = await recordMatch(
    {
      type: body.type,
      playerAId: body.playerAId!,
      playerBId: body.playerBId!,
      scoreA: Number(body.scoreA ?? 0),
      scoreB: Number(body.scoreB ?? 0),
      winnerId: body.winnerId!,
      tableName: body.tableName!,
      tournamentId: body.tournamentId ?? null,
      tournamentRound: body.tournamentRound ?? null,
      playedAt: body.playedAt,
    },
    actor,
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json({ ok: true, match: res.match }, { status: 201 });
}
