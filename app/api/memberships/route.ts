import { NextResponse } from "next/server";
import { getMembershipPlans, getRewards } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [plans, rewards] = await Promise.all([
    getMembershipPlans(),
    getRewards(),
  ]);
  return NextResponse.json({ plans, rewards });
}
