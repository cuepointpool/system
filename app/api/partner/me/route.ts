import { NextResponse } from "next/server";
import { isTreasurer, partnerViewer } from "@/lib/partners";

export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await partnerViewer();
  if (!partner) return NextResponse.json({ partner: null });
  return NextResponse.json({
    partner: {
      name: partner.name,
      username: partner.username,
      positions: partner.positions,
      canEditFinance: isTreasurer(partner),
    },
  });
}
