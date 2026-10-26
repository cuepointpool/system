import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { partnerViewer } from "@/lib/partners";
import { AccountsError } from "@/lib/accounts";
import { getSignature, setSignature } from "@/lib/statements";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 422) => NextResponse.json({ error }, { status });

/** An investor manages their own signature; an admin can manage anyone's. */
async function whose(req: NextRequest, requested: string | null) {
  const [admin, partner] = await Promise.all([adminActor(req), partnerViewer()]);
  if (admin) return requested ? { id: requested, actor: admin } : null;
  if (partner && (!requested || requested === partner.id))
    return { id: partner.id, actor: `partner:${partner.username ?? partner.name}` };
  return null;
}

export async function GET(req: NextRequest) {
  const who = await whose(req, new URL(req.url).searchParams.get("id"));
  if (!who) return fail("Not authorized", 403);
  return NextResponse.json({ image: await getSignature(who.id) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const who = await whose(req, body.id ? String(body.id) : null);
  if (!who) return fail("Not authorized", 403);
  try {
    await setSignature(who.id, body.image ? String(body.image) : null, who.actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccountsError) return fail(err.message);
    console.error("signature POST error", err);
    return fail("Could not save", 500);
  }
}
