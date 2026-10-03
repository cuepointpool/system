/* ============================================================
   Campaign supervision — an admin's pass code approves a player's
   mission progress.

   A player can't record their own results. After watching the game,
   an admin types their personal pass code on the player's phone; the
   server checks it against every admin's stored (scrypt-hashed) code
   and records which admin approved. Wrong guesses are throttled per
   player so a code can't be found by trial.
   ============================================================ */

import { hashPassword, verifyPassword } from "../auth";
import { query } from "../pg";

/** 4–8 digits: quick to type on someone else's phone, never the login password */
export const CODE_RULE = /^\d{4,8}$/;
export const CODE_HELP = "Use 4 to 8 digits.";

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;
const fails = new Map<string, { count: number; resetAt: number }>();

/** seconds left on this player's lock-out after too many wrong codes, or 0 */
export function codeLockedFor(playerId: string): number {
  const f = fails.get(playerId);
  if (!f) return 0;
  if (f.resetAt <= Date.now()) {
    fails.delete(playerId);
    return 0;
  }
  return f.count >= MAX_FAILS ? Math.ceil((f.resetAt - Date.now()) / 1000) : 0;
}

function recordFail(playerId: string) {
  const now = Date.now();
  const f = fails.get(playerId);
  if (!f || f.resetAt <= now) fails.set(playerId, { count: 1, resetAt: now + LOCK_MS });
  else f.count += 1;
}

export interface Supervisor {
  id: string;
  slug: string;
}

export type CodeCheck =
  | { ok: true; admin: Supervisor }
  | { ok: false; reason: "locked" | "none_set" | "wrong"; retryAfter?: number };

/** Which admin does this pass code belong to? Counts a wrong guess against `playerId`. */
export async function checkSupervisorCode(playerId: string, code: string): Promise<CodeCheck> {
  const locked = codeLockedFor(playerId);
  if (locked) return { ok: false, reason: "locked", retryAfter: locked };

  const admins = await query<{ id: string; slug: string; supervisor_code_hash: string }>(
    `SELECT id, slug, supervisor_code_hash FROM player_profiles
      WHERE role = 'admin' AND supervisor_code_hash IS NOT NULL`,
    [],
  );
  if (!admins.length) return { ok: false, reason: "none_set" };

  const entered = String(code ?? "").trim();
  if (CODE_RULE.test(entered)) {
    for (const a of admins) {
      if (verifyPassword(entered, a.supervisor_code_hash)) {
        fails.delete(playerId);
        return { ok: true, admin: { id: a.id, slug: a.slug } };
      }
    }
  }
  recordFail(playerId);
  return { ok: false, reason: "wrong" };
}

/** Set (or with an empty string, clear) an admin's own pass code. */
export async function setSupervisorCode(adminId: string, code: string): Promise<void> {
  await query(
    `UPDATE player_profiles SET supervisor_code_hash = $2 WHERE id = $1 AND role = 'admin'`,
    [adminId, code ? hashPassword(code) : null],
  );
}

export async function hasSupervisorCode(adminId: string): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT supervisor_code_hash IS NOT NULL AS ok FROM player_profiles WHERE id = $1`,
    [adminId],
  );
  return !!rows[0]?.ok;
}
