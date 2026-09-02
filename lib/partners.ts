/* ============================================================
   Business-partner logins + committee positions.

   Partners live in `business_partners`. When given a username +
   password they can sign in at /partners (separate `cp_partner`
   cookie, same signed-token scheme as player sessions).

   Access to the finance module:
     - position 'treasurer'  → may edit (POST/PATCH/DELETE)
     - any other signed-in partner → read-only (GET)
     - a signed-in admin player → full access (unchanged)

   Assigning usernames / passwords / positions is admin-only
   (see app/api/admin/partners/route.ts).
   ============================================================ */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  PARTNER_COOKIE,
  createSessionToken,
  hashPassword,
  readSessionToken,
  verifyPassword,
} from "./auth";
import { adminActor } from "./ecosystem/identity";
import { audit } from "./ecosystem/store";
import { query } from "./pg";

export const PARTNER_POSITIONS = [
  "director",
  "it_admin",
  "secretary",
  "marketing",
  "treasurer",
] as const;
export type PartnerPosition = (typeof PARTNER_POSITIONS)[number];

export const POSITION_LABELS: Record<PartnerPosition, string> = {
  director: "Director",
  it_admin: "IT Admin",
  secretary: "Secretary",
  marketing: "Marketing",
  treasurer: "Treasurer",
};

const isPosition = (v: string): v is PartnerPosition =>
  (PARTNER_POSITIONS as readonly string[]).includes(v);

export function cleanPositions(input: unknown): PartnerPosition[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(String))].filter(isPosition);
}

export interface PartnerAccount {
  id: string;
  name: string;
  username: string | null;
  positions: PartnerPosition[];
  active: boolean;
  hasLogin: boolean;
}

interface PartnerRow {
  id: string;
  name: string;
  username: string | null;
  password_hash: string | null;
  positions: string[] | null;
  active: boolean;
}

const toAccount = (r: PartnerRow): PartnerAccount => ({
  id: r.id,
  name: r.name,
  username: r.username,
  positions: (r.positions ?? []).filter(isPosition),
  active: r.active,
  hasLogin: !!r.username && !!r.password_hash,
});

export const isTreasurer = (a: PartnerAccount | null): boolean =>
  !!a && a.positions.includes("treasurer");

/* ------------------------------- lookups ------------------------------- */

async function rowByUsername(username: string): Promise<PartnerRow | null> {
  const rows = await query<PartnerRow>(
    `SELECT * FROM business_partners WHERE lower(username) = lower($1) LIMIT 1`,
    [username.trim()],
  );
  return rows[0] ?? null;
}

export async function getPartnerAccountById(
  id: string,
): Promise<PartnerAccount | null> {
  const rows = await query<PartnerRow>(
    `SELECT * FROM business_partners WHERE id = $1`,
    [id],
  );
  return rows[0] ? toAccount(rows[0]) : null;
}

/* ------------------------------- session ------------------------------- */

export function partnerSessionToken(id: string): string {
  return createSessionToken(id);
}

/** The partner making this request, from the `cp_partner` cookie. */
export async function partnerViewer(): Promise<PartnerAccount | null> {
  const store = await cookies();
  const id = readSessionToken(store.get(PARTNER_COOKIE)?.value);
  if (!id || !id.startsWith("bp_")) return null;
  const acct = await getPartnerAccountById(id);
  return acct && acct.active ? acct : null;
}

export async function verifyPartnerLogin(
  username: string,
  password: string,
): Promise<PartnerAccount | null> {
  const row = await rowByUsername(username);
  if (!row || !row.active || !row.password_hash) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return toAccount(row);
}

/* ---------------------------- access guards --------------------------- */

/** Actor string if the request may VIEW finance (admin or any partner). */
export async function financeViewer(req: NextRequest): Promise<string | null> {
  const admin = await adminActor(req);
  if (admin) return admin;
  const p = await partnerViewer();
  return p ? `partner:${p.username ?? p.name}` : null;
}

/** Actor string if the request may EDIT finance (admin or treasurer). */
export async function financeEditor(req: NextRequest): Promise<string | null> {
  const admin = await adminActor(req);
  if (admin) return admin;
  const p = await partnerViewer();
  return isTreasurer(p) ? `partner:${p!.username ?? p!.name}` : null;
}

/* ------------------------- admin: manage access ---------------------- */

export interface PartnerAccessPatch {
  username?: string | null;
  password?: string;
  positions?: unknown;
}

export async function setPartnerAccess(
  id: string,
  patch: PartnerAccessPatch,
  actor: string,
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (patch.username !== undefined) {
    const u = patch.username ? String(patch.username).trim() : "";
    vals.push(u || null);
    sets.push(`username = $${vals.length}`);
  }
  if (patch.password) {
    vals.push(hashPassword(String(patch.password)));
    sets.push(`password_hash = $${vals.length}`);
  }
  if (patch.positions !== undefined) {
    vals.push(cleanPositions(patch.positions));
    sets.push(`positions = $${vals.length}`);
  }
  if (!sets.length) return;

  vals.push(id);
  await query(
    `UPDATE business_partners SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals,
  );
  await audit(actor, "finance.partner.access", "partner", id, sets.join(", "));
}
