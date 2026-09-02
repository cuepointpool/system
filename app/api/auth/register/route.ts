import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  hashPassword,
} from "@/lib/auth";
import { createPlayerAccount, getAuthByEmail } from "@/lib/ecosystem/store";
import { authGuard } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = authGuard(req, {
    scope: "register",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const fullName = String(body.fullName ?? "").trim();
  const nickname = String(body.nickname ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (fullName.length < 2) return err("Enter your full name");
  if (!/^[a-zA-Z0-9_]{2,20}$/.test(nickname))
    return err("Player name: 2–20 letters, numbers or underscores");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid email");
  if (password.length < 8) return err("Password must be at least 8 characters");

  if (await getAuthByEmail(email))
    return err("An account with that email already exists", 409);

  const player = await createPlayerAccount({
    fullName,
    nickname,
    email,
    passwordHash: hashPassword(password),
  });

  const res = NextResponse.json({
    ok: true,
    player: { slug: player.slug, nickname: player.nickname, role: player.role },
  });
  res.cookies.set(SESSION_COOKIE, createSessionToken(player.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

function err(message: string, status = 422) {
  return NextResponse.json({ error: message }, { status });
}
