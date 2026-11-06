import { NextRequest, NextResponse } from "next/server";
import { CLUB_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { clubSessionToken, verifyClubLogin } from "@/lib/clubs/store";
import { audit } from "@/lib/ecosystem/store";
import { authGuard, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** a partner club's admin signs in with the username + password Cue Point gave them */
export async function POST(req: NextRequest) {
  const blocked = authGuard(req, { scope: "club-login", limit: 10, windowMs: 5 * 60_000 });
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password)
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });

  const club = await verifyClubLogin(username, password);
  if (!club) {
    await audit(`club:${username.slice(0, 60)}`, "auth.club.login.fail", "club", "", `ip ${clientIp(req)}`);
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  await audit(`club:${club.username}`, "auth.club.login", "club", club.id, `ip ${clientIp(req)}`);
  const res = NextResponse.json({ ok: true, club: { slug: club.slug, name: club.name } });
  res.cookies.set(CLUB_COOKIE, clubSessionToken(club), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
