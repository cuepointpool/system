import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";
import { bumpPlayerSessions, getViewer } from "@/lib/ecosystem/identity";
import { audit } from "@/lib/ecosystem/store";
import { beginTwoStep, disableTwoStep, enableTwoStep, twoStepStatus } from "@/lib/ecosystem/two-step";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 422) => NextResponse.json({ error }, { status });

/** Is two-step sign-in on for the signed-in account? */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first", 401);
  return NextResponse.json(await twoStepStatus(viewer.id));
}

/** { action: "setup" } | { action: "enable", code } | { action: "disable", code } */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in first", 401);
  // codes are 6 digits — cap guesses per account
  const limited = rateLimit(`2fa:${viewer.id}`, 10, 10 * 60_000);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");

  if (body.action === "setup") {
    const { enabled } = await twoStepStatus(viewer.id);
    if (enabled) return fail("Two-step sign-in is already on");
    return NextResponse.json(await beginTwoStep(viewer.id, viewer.email ?? viewer.slug));
  }

  if (body.action === "enable") {
    if (!(await enableTwoStep(viewer.id, code))) return fail("That code isn't right — try the newest one");
    // turning it on signs out every other device; this one gets a fresh session
    const version = await bumpPlayerSessions(viewer.id);
    await audit(viewer.slug, "auth.2fa.enable", "player", viewer.id, "");
    const res = NextResponse.json({ enabled: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(viewer.id, version), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  }

  if (body.action === "disable") {
    if (!(await disableTwoStep(viewer.id, code))) return fail("That code isn't right — try the newest one");
    await audit(viewer.slug, "auth.2fa.disable", "player", viewer.id, "");
    return NextResponse.json({ enabled: false });
  }

  return fail("Unknown action");
}
