import { NextResponse } from "next/server";
import { getCampaignLeaderboard } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getCampaignLeaderboard();
  return NextResponse.json({ rows });
}
