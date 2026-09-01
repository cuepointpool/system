import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { getAuthByEmail } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password)
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const auth = await getAuthByEmail(email);
  if (!auth || !auth.passwordHash || !verifyPassword(password, auth.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const res = NextResponse.json({
    ok: true,
    player: { slug: auth.slug, role: auth.role },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(auth.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
