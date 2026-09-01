import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/ecosystem/store";
import type { RankingScope } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

const SCOPES: RankingScope[] = ["weekly", "monthly", "all_time", "tournament"];

export async function GET(req: NextRequest) {
  const scopeParam = (new URL(req.url).searchParams.get("scope") ??
    "all_time") as RankingScope;
  const scope = SCOPES.includes(scopeParam) ? scopeParam : "all_time";
  return NextResponse.json({ scope, rows: await getLeaderboard(scope) });
}
