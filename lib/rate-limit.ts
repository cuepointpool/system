/* ============================================================
   Lightweight in-process rate limiting + request-size guard for
   the auth endpoints. Single EC2 instance, so an in-memory map is
   enough; it resets on deploy, which is acceptable for brute-force
   defence. Behind CloudFront + nginx realip, the client IP is in
   `x-real-ip` (nginx sets it from the CloudFront-verified XFF).
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// opportunistic cleanup so the map can't grow unbounded
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export function clientIp(req: NextRequest): string {
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // CloudFront appends the true viewer IP; nginx appends one more hop.
    // The real client is the second-to-last entry, else the first.
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 2] ?? parts[0] ?? "unknown";
  }
  return "unknown";
}

/**
 * Returns a 429 response if `key` has exceeded `limit` hits within
 * `windowMs`, otherwise null. Call once per protected request.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  sweep(now);
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  cur.count += 1;
  if (cur.count > limit) {
    const retry = Math.ceil((cur.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }
  return null;
}

/** 413 if the request body is larger than `maxBytes` (Content-Length based). */
export function tooLarge(req: NextRequest, maxBytes: number): NextResponse | null {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  return null;
}

/**
 * Guard for auth endpoints: body-size cap + per-IP rate limit.
 * Returns a response to send immediately, or null to proceed.
 */
export function authGuard(
  req: NextRequest,
  opts: { limit: number; windowMs: number; scope: string; maxBody?: number },
): NextResponse | null {
  const big = tooLarge(req, opts.maxBody ?? 16_384);
  if (big) return big;
  return rateLimit(`${opts.scope}:${clientIp(req)}`, opts.limit, opts.windowMs);
}
