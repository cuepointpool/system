import { NextRequest, NextResponse } from "next/server";
import { PARTNER_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import {
  isTreasurer,
  partnerSessionToken,
  verifyPartnerLogin,
} from "@/lib/partners";
import { authGuard } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = authGuard(req, {
    scope: "partner-login",
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password)
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );

  const partner = await verifyPartnerLogin(username, password);
  if (!partner)
    return NextResponse.json(
      { error: "Wrong username or password" },
      { status: 401 },
    );

  const res = NextResponse.json({
    ok: true,
    partner: {
      name: partner.name,
      username: partner.username,
      positions: partner.positions,
      canEditFinance: isTreasurer(partner),
    },
  });
  res.cookies.set(PARTNER_COOKIE, partnerSessionToken(partner.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
