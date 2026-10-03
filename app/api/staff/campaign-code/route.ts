import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/ecosystem/identity";
import { audit } from "@/lib/ecosystem/store";
import {
  CODE_HELP,
  CODE_RULE,
  hasSupervisorCode,
  setSupervisorCode,
} from "@/lib/campaign/supervisor";

export const dynamic = "force-dynamic";

/* An admin's own campaign pass code. It belongs to a signed-in admin account —
   the shared staff key can't set one, because approvals are recorded by name. */

export async function GET() {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  return NextResponse.json({ set: await hasSupervisorCode(viewer.id) });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (code && !CODE_RULE.test(code))
    return NextResponse.json({ error: CODE_HELP }, { status: 422 });
  await setSupervisorCode(viewer.id, code);
  await audit(
    viewer.slug,
    code ? "campaign.code.set" : "campaign.code.clear",
    "player",
    viewer.id,
    "",
  );
  return NextResponse.json({ ok: true, set: !!code });
}
