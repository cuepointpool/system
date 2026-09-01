import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  createPromotion,
  deletePromotion,
  getPromotions,
  setPromotionStatus,
} from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  return NextResponse.json({
    promotions: await getPromotions({ includeExpired: true, includeHidden: true }),
  });
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!String(body.title ?? "").trim() || !body.startAt || !body.endAt || !body.discount)
    return NextResponse.json(
      { error: "Title, dates and discount are required" },
      { status: 422 },
    );
  const promo = await createPromotion(
    {
      title: String(body.title),
      description: body.description,
      type: body.type,
      image: body.image,
      startAt: body.startAt,
      endAt: body.endAt,
      eligibility: body.eligibility,
      discount: String(body.discount),
      promoCode: body.promoCode || null,
      membershipRestriction: Array.isArray(body.membershipRestriction)
        ? body.membershipRestriction
        : null,
      usageNote: body.usageNote || null,
    },
    actor,
  );
  return NextResponse.json({ ok: true, promotion: promo }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  if (body.status === "active" || body.status === "hidden") {
    await setPromotionStatus(body.id, body.status, actor);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  await deletePromotion(id, actor);
  return NextResponse.json({ ok: true });
}
