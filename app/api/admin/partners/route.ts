import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { listPartners } from "@/lib/finance";
import { PARTNER_POSITIONS, setPartnerAccess } from "@/lib/partners";

export const dynamic = "force-dynamic";

/** Admin-only: assign a partner's username, password and committee positions. */
export async function GET(req: NextRequest) {
  if (!(await adminActor(req)))
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const partners = await listPartners();
  return NextResponse.json({
    positions: PARTNER_POSITIONS,
    partners: partners.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
      username: p.username,
      positions: p.positions,
      hasLogin: !!p.username,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const actor = await adminActor(req);
  if (!actor)
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing partner id" }, { status: 422 });

  const password = body.password ? String(body.password) : undefined;
  if (password !== undefined && password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 422 },
    );

  const username =
    body.username === undefined ? undefined : String(body.username ?? "").trim();
  if (typeof username === "string" && username && !/^[a-zA-Z0-9_.-]{3,32}$/.test(username))
    return NextResponse.json(
      { error: "Username: 3–32 letters, numbers, dot, dash or underscore" },
      { status: 422 },
    );

  try {
    await setPartnerAccess(
      id,
      { username, password, positions: body.positions },
      actor,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? "");
    if (msg.includes("business_partners_username_key"))
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 },
      );
    console.error("admin/partners PATCH error", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
