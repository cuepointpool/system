import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  getMembershipPlans,
  getRewards,
  updateMembershipPlan,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const [plans, rewards] = await Promise.all([
    getMembershipPlans(),
    getRewards(),
  ]);
  return NextResponse.json({ plans, rewards });
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Missing plan id" }, { status: 422 });
  const plan = await updateMembershipPlan(
    body.id,
    {
      name: body.name,
      price: body.price != null ? Number(body.price) : undefined,
      tagline: body.tagline,
      discountPct: body.discountPct != null ? Number(body.discountPct) : undefined,
      loyaltyMultiplier:
        body.loyaltyMultiplier != null ? Number(body.loyaltyMultiplier) : undefined,
      featured: body.featured,
      benefits: Array.isArray(body.benefits) ? body.benefits : undefined,
    },
    actor,
  );
  return NextResponse.json({ ok: true, plan });
}
