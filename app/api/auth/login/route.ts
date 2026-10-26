import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { audit, getAuthByEmail } from "@/lib/ecosystem/store";
import { checkTwoStepCode } from "@/lib/ecosystem/two-step";
import { clientIp } from "@/lib/rate-limit";
import { authGuard } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = authGuard(req, {
    scope: "login",
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password)
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const auth = await getAuthByEmail(email);
  if (!auth || !auth.passwordHash || !verifyPassword(password, auth.passwordHash)) {
    await audit(email.slice(0, 120), "auth.login.fail", "player", auth?.id ?? "", `ip ${clientIp(req)}`);
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  // two-step sign-in: the password was right, now the authenticator code
  if (auth.totp) {
    const code = String(body?.code ?? "").trim();
    if (!code)
      return NextResponse.json(
        { error: "Enter the 6-digit code from your authenticator app", needCode: true },
        { status: 401 },
      );
    if (!(await checkTwoStepCode(auth.id, code))) {
      await audit(auth.slug, "auth.login.code_fail", "player", auth.id, `ip ${clientIp(req)}`);
      return NextResponse.json({ error: "That code isn't right — try the newest one", needCode: true }, { status: 401 });
    }
  }

  await audit(auth.slug, "auth.login", "player", auth.id, `ip ${clientIp(req)}`);
  const res = NextResponse.json({
    ok: true,
    player: { slug: auth.slug, role: auth.role },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(auth.id, auth.sessionVersion), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
