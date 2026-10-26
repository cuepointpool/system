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

/* ---- session token: "<id>.<expiresAt>.<version>.<hmac>" ----
   `version` is the account's session_version when the token was issued.
   Bumping that column (password change, "sign out everywhere", 2FA on)
   invalidates every token issued before it. Tokens issued before
   versioning ("<id>.<expiresAt>.<hmac>") count as version 0. */

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(id: string, version = 0): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${id}.${exp}.${version}`;
  return `${payload}.${sign(payload)}`;
}

/** The account id + session version a valid, unexpired token was issued for. */
export function readSession(token: string | undefined): { id: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const mac = parts.pop()!;
  const expected = sign(parts.join("."));
  if (
    mac.length !== expected.length ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  const [id, expStr, verStr = "0"] = parts;
  if (!(Number(expStr) >= Date.now())) return null;
  const version = Number(verStr);
  if (!Number.isInteger(version) || version < 0) return null;
  return { id, version };
}
