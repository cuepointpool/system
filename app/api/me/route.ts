import { NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { computeStats } from "@/lib/ecosystem/store";
import { isTreasurer, partnerViewer } from "@/lib/partners";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();

  // A business partner (cp_partner cookie) is not a player, but the rest of
  // the site should still show them as signed in rather than anonymous.
  const partnerAcct = viewer ? null : await partnerViewer();
  const partner = partnerAcct
    ? {
        name: partnerAcct.name,
        username: partnerAcct.username,
        positions: partnerAcct.positions,
        canEditFinance: isTreasurer(partnerAcct),
      }
    : null;

  if (!viewer) return NextResponse.json({ viewer: null, partner });

  const { stats } = await computeStats();
  return NextResponse.json({
    viewer: {
      slug: viewer.slug,
      nickname: viewer.nickname,
      fullName: viewer.fullName,
      email: viewer.email,
      membershipTier: viewer.membershipTier,
      role: viewer.role,
      rank: viewer.role === "player" ? stats.get(viewer.id)?.rank ?? 0 : 0,
    },
    partner: null,
  });
}
