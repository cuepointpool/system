import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { bumpPlayerSessions, getViewer } from "@/lib/ecosystem/identity";
import { audit } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

/** Sign out. `{ everywhere: true }` also ends the account's sessions on every other device. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.everywhere) {
    const viewer = await getViewer();
    if (viewer) {
      await bumpPlayerSessions(viewer.id);
      await audit(viewer.slug, "auth.logout.everywhere", "player", viewer.id, "");
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
