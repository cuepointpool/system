/* ============================================================
   Authentication primitives — password hashing + signed session
   cookie. No external dependencies (node:crypto only).
   ============================================================ */

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SECRET =
  process.env.SESSION_SECRET ||
  process.env.DATABASE_URL || // stable per-install fallback for local dev
  "cue-point-dev-secret";

export const SESSION_COOKIE = "cp_session";
/** Separate session for business-partner logins (see lib/partners.ts). */
export const PARTNER_COOKIE = "cp_partner";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ---- passwords ---- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && timingSafeEqual(test, known);
}

/* ---- session token: "<playerId>.<expiresAt>.<hmac>" ---- */

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(playerId: string): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${playerId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [playerId, expStr, mac] = parts;
  const payload = `${playerId}.${expStr}`;
  const expected = sign(payload);
  if (
    mac.length !== expected.length ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  if (Number(expStr) < Date.now()) return null;
  return playerId;
}
