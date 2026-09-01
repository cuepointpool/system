import { NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { computeStats } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ viewer: null });
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
  });
}
