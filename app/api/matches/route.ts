import { NextRequest, NextResponse } from "next/server";
import { getMatches, getPlayerBySlug } from "@/lib/ecosystem/store";
import type { MatchType } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

const TYPES: MatchType[] = ["casual", "ranked", "tournament"];

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const typeParam = sp.get("type") as MatchType | null;
  const type = typeParam && TYPES.includes(typeParam) ? typeParam : undefined;
  const playerSlug = sp.get("player");
  const playerId = playerSlug
    ? (await getPlayerBySlug(playerSlug))?.id
    : undefined;
  const result = sp.get("result") as "W" | "L" | null;
  const limit = Math.min(200, Number(sp.get("limit")) || 60);

  const matches = await getMatches({
    type,
    playerId,
    result: result === "W" || result === "L" ? result : undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    limit,
  });

  return NextResponse.json({ count: matches.length, matches });
}
