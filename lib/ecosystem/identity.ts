/* ============================================================
   Who is making this request?

   Player identity comes from a signed `cp_session` cookie set at
   sign-in (see lib/auth.ts + /api/auth/*). Staff/admin actions
   additionally accept an `x-staff-key` header matching STAFF_KEY
   (for scripts / integrations).
   ============================================================ */

import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "../auth";
import { getPlayerById } from "./store";
import type { PlayerProfile } from "./types";

export async function getViewer(): Promise<PlayerProfile | null> {
  const store = await cookies();
  const playerId = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!playerId) return null;
  return (await getPlayerById(playerId)) ?? null;
}

export async function isStaffViewer(): Promise<boolean> {
  const viewer = await getViewer();
  return viewer?.role === "staff" || viewer?.role === "admin";
}

/* ---- staff key (scripts / API integrations) ---- */

export const STAFF_KEY = process.env.STAFF_KEY || process.env.ADMIN_KEY || "";

/** true if the request may perform staff actions (session role OR staff key) */
export async function canStaff(req?: NextRequest): Promise<boolean> {
  if (await isStaffViewer()) return true;
  if (!STAFF_KEY) {
    // no key configured AND no staff logged in → allow only in local dev
    return process.env.NODE_ENV !== "production";
  }
  const provided = req
    ? req.headers.get("x-staff-key") ||
      new URL(req.url).searchParams.get("key") ||
      ""
    : (await headers()).get("x-staff-key") || "";
  return provided === STAFF_KEY;
}

/**
 * Guard for staff API routes. Returns the actor name (the logged-in
 * staff member's handle, or "staff-key") when authorized, otherwise null.
 */
export async function staffActor(req: NextRequest): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer?.role === "staff" || viewer?.role === "admin") return viewer.slug;
  if (await canStaff(req)) {
    return req.headers.get("x-staff-name") || "staff-key";
  }
  return null;
}

/**
 * Guard for admin-only routes (business finance). Requires a signed-in
 * admin, or the staff key when one is configured. Staff-role accounts do
 * NOT pass.
 */
export async function adminActor(req: NextRequest): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer?.role === "admin") return viewer.slug;
  if (STAFF_KEY && req.headers.get("x-staff-key") === STAFF_KEY) return "admin-key";
  return null;
}
