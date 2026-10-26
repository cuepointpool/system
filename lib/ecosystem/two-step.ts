/* ============================================================
   Two-step sign-in (authenticator-app codes) for player accounts.
   Setup stores a pending secret; it only becomes active once the
   player proves their app produces a matching code. Every accepted
   code's time step is stored so the same code can't be used twice.
   ============================================================ */

import { query, queryOne } from "../pg";
import { matchTotp, newTotpSecret, totpUri } from "../totp";

export async function twoStepStatus(id: string): Promise<{ enabled: boolean }> {
  const r = await queryOne<{ enabled: boolean }>(
    `SELECT (totp_secret IS NOT NULL) AS enabled FROM player_profiles WHERE id = $1`,
    [id],
  );
  return { enabled: !!r?.enabled };
}

/** Start (or restart) setup: a new pending secret for the app to scan. */
export async function beginTwoStep(id: string, account: string): Promise<{ secret: string; uri: string }> {
  const secret = newTotpSecret();
  await query(`UPDATE player_profiles SET totp_pending = $2 WHERE id = $1`, [id, secret]);
  return { secret, uri: totpUri(secret, account) };
}

/** Accept a code against the stored secret (`pending` during setup), once per time step. */
async function acceptCode(id: string, code: string, which: "totp_secret" | "totp_pending"): Promise<boolean> {
  const r = await queryOne<{ s: string | null }>(`SELECT ${which} AS s FROM player_profiles WHERE id = $1`, [id]);
  if (!r?.s) return false;
  const step = matchTotp(r.s, code);
  if (step === null) return false;
  // atomic replay guard: only a newer step than the last accepted one counts
  const rows = await query(
    `UPDATE player_profiles SET totp_last_step = $2
      WHERE id = $1 AND COALESCE(totp_last_step, -1) < $2 RETURNING 1`,
    [id, step],
  );
  return rows.length === 1;
}

export const checkTwoStepCode = (id: string, code: string) => acceptCode(id, code, "totp_secret");

/** Finish setup with a code from the app. */
export async function enableTwoStep(id: string, code: string): Promise<boolean> {
  if (!(await acceptCode(id, code, "totp_pending"))) return false;
  await query(
    `UPDATE player_profiles SET totp_secret = totp_pending, totp_pending = NULL WHERE id = $1`,
    [id],
  );
  return true;
}

/** Turn it off — needs a current code, so a stolen session alone can't. */
export async function disableTwoStep(id: string, code: string): Promise<boolean> {
  if (!(await checkTwoStepCode(id, code))) return false;
  await query(`UPDATE player_profiles SET totp_secret = NULL, totp_pending = NULL WHERE id = $1`, [id]);
  return true;
}
