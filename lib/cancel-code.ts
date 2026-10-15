import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/* ------------------------------------------------------------------
   One-time codes that guard "cancel the whole tournament". The code is
   shown to the person cancelling and has to be typed back — a deliberate
   second step, so a stray tap can never wipe out a running event. Only a
   hash is stored, and it expires quickly.
   ------------------------------------------------------------------ */

export const CANCEL_CODE_MINUTES = 10;

const hash = (code: string) =>
  createHash("sha256").update(`cuepoint-cancel:${code.trim()}`).digest("hex");

/** a fresh 6-digit code and the hash to store with its expiry */
export function newCancelCode(): { code: string; hash: string; expires: Date } {
  const code = String(randomInt(100000, 1000000));
  return { code, hash: hash(code), expires: new Date(Date.now() + CANCEL_CODE_MINUTES * 60_000) };
}

/** does `typed` match the stored, unexpired code? */
export function cancelCodeOk(
  typed: unknown,
  storedHash: string | null,
  expires: Date | string | null,
): boolean {
  if (typeof typed !== "string" || !/^\d{6}$/.test(typed.trim()) || !storedHash || !expires) return false;
  if (new Date(expires).getTime() < Date.now()) return false;
  const a = Buffer.from(hash(typed), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
