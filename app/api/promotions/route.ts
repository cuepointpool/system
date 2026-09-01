import { NextRequest, NextResponse } from "next/server";
import { getPromotions } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const includeExpired = new URL(req.url).searchParams.get("expired") === "1";
  return NextResponse.json({ promotions: await getPromotions({ includeExpired }) });
}
