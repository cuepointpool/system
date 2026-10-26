import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { accountsViewer, partnerViewer } from "@/lib/partners";
import { AccountsError } from "@/lib/accounts";
import { CONFIRM_WORD, cancelReview, decideReview, listReviews, submitReview } from "@/lib/statements";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 422) => NextResponse.json({ error }, { status });
const confirmed = (v: unknown) => String(v ?? "").trim().toUpperCase() === CONFIRM_WORD;

function handle(err: unknown, what: string) {
  if (err instanceof AccountsError) return fail(err.message);
  console.error(`statements ${what} error`, err);
  return fail("Something went wrong", 500);
}

/** Balance sheets waiting for, or signed off by, the investors. */
export async function GET(req: NextRequest) {
  if (!(await accountsViewer(req))) return fail("Not authorized", 403);
  try {
    return NextResponse.json({ reviews: await listReviews() });
  } catch (err) {
    return handle(err, "GET");
  }
}

/** { action: "submit", month, taxRate, confirm } | { action: "approve" | "reject", id, confirm?, note? } */
export async function POST(req: NextRequest) {
  const actor = await accountsViewer(req);
  if (!actor) return fail("Not authorized", 403);
  const [admin, partner] = await Promise.all([adminActor(req), partnerViewer()]);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "submit") {
      if (!admin && !partner?.positions.includes("treasurer"))
        return fail("Only the treasurer can submit statements", 403);
      if (partner && !confirmed(body.confirm)) return fail(`Type ${CONFIRM_WORD} to sign and submit`);
      const id = await submitReview(
        { month: String(body.month ?? ""), taxRate: Number(body.taxRate) || 0, signerId: admin ? null : partner!.id },
        actor,
      );
      return NextResponse.json({ id }, { status: 201 });
    }
    if (body.action === "approve" || body.action === "reject") {
      // approvals are personal — only the investor themselves can sign
      if (!partner) return fail("Sign in with your investor login to approve", 403);
      if (body.action === "approve" && !confirmed(body.confirm)) return fail(`Type ${CONFIRM_WORD} to sign`);
      if (body.action === "reject" && !String(body.note ?? "").trim()) return fail("Say what needs fixing");
      await decideReview(
        { id: String(body.id ?? ""), partnerId: partner.id, decision: body.action, note: body.note ? String(body.note) : "" },
        actor,
      );
      return NextResponse.json({ ok: true });
    }
    return fail("Unknown action");
  } catch (err) {
    return handle(err, "POST");
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await accountsViewer(req);
  if (!actor) return fail("Not authorized", 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Missing id");
  try {
    await cancelReview(id, actor, !!(await adminActor(req)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err, "DELETE");
  }
}
