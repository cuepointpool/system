import { NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { getCampaignState } from "@/lib/campaign/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const state = await getCampaignState(viewer.id);
  return NextResponse.json(state);
}
