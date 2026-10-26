import { audit, rid } from "./ecosystem/store";
import { query, transaction } from "./pg";
import { AccountsError, reportData, todayLK } from "./accounts";
import type { ReportData } from "./accounts-reports";

/* ------------------------------------------------------------------
   Signed balance sheets.

   Each investor stores a transparent signature image. The treasurer
   submits a month's balance sheet: the figures are frozen into the
   review, and every investor with a share must approve it by typing
   APPROVE — their signature is copied onto the review. Once everyone
   has approved, the signed PDF can be downloaded (it's built in the
   browser from the frozen figures; no file is stored). One rejection
   sends it back. Reviews are short-lived: finished ones are deleted
   after 7 days, anything older than 30 days regardless.
   ------------------------------------------------------------------ */

const SIGNATURE_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
export const MAX_SIGNATURE_CHARS = 600_000; // ~450KB PNG
export const CONFIRM_WORD = "APPROVE";

export interface Signer {
  id: string;
  name: string;
  sharePct: number;
}

export interface Approval {
  partnerId: string;
  decision: "approve" | "reject";
  note: string;
  signature: string | null;
  at: string;
}

export interface Review {
  id: string;
  month: string;
  from: string;
  to: string;
  taxRate: number;
  snapshot: ReportData;
  investors: Signer[];
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  createdAt: string;
  completedAt: string | null;
  approvals: Approval[];
}

const iso = (v: Date | string | null) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/* ------------------------------ signatures ------------------------------ */

export async function setSignature(partnerId: string, image: string | null, actor: string): Promise<void> {
  if (image !== null) {
    if (!SIGNATURE_RE.test(image)) throw new AccountsError("Signature must be a PNG image");
    if (image.length > MAX_SIGNATURE_CHARS) throw new AccountsError("Signature image is too large");
  }
  await query(`UPDATE business_partners SET signature_image = $2 WHERE id = $1`, [partnerId, image]);
  await audit(actor, image ? "accounts.signature.set" : "accounts.signature.remove", "partner", partnerId, "");
}

export async function getSignature(partnerId: string): Promise<string | null> {
  const rows = await query<{ signature_image: string | null }>(
    `SELECT signature_image FROM business_partners WHERE id = $1`,
    [partnerId],
  );
  return rows[0]?.signature_image ?? null;
}

/* -------------------------------- reviews ------------------------------- */

async function purgeOld(): Promise<void> {
  await query(
    `DELETE FROM statement_reviews
      WHERE (status <> 'pending' AND completed_at < now() - INTERVAL '7 days')
         OR created_at < now() - INTERVAL '30 days'`,
  );
}

export async function listReviews(): Promise<Review[]> {
  await purgeOld();
  const [reviews, approvals] = await Promise.all([
    query<{
      id: string;
      month: string;
      period_from: string;
      period_to: string;
      tax_rate: string;
      snapshot: ReportData;
      investors: Signer[];
      status: Review["status"];
      submitted_by: string;
      created_at: Date;
      completed_at: Date | null;
    }>(`SELECT * FROM statement_reviews ORDER BY created_at DESC LIMIT 24`),
    query<{ review_id: string; partner_id: string; decision: Approval["decision"]; note: string; signature: string | null; at: Date }>(
      `SELECT * FROM statement_approvals ORDER BY at`,
    ),
  ]);
  return reviews.map((r) => ({
    id: r.id,
    month: r.month,
    from: String(r.period_from).slice(0, 10),
    to: String(r.period_to).slice(0, 10),
    taxRate: Number(r.tax_rate),
    snapshot: r.snapshot,
    investors: r.investors,
    status: r.status,
    submittedBy: r.submitted_by,
    createdAt: iso(r.created_at)!,
    completedAt: iso(r.completed_at),
    approvals: approvals
      .filter((a) => a.review_id === r.id)
      .map((a) => ({ partnerId: a.partner_id, decision: a.decision, note: a.note, signature: a.signature, at: iso(a.at)! })),
  }));
}

/** Last day of a 'YYYY-MM' month, or today if the month isn't over yet. */
function asAt(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = todayLK();
  return { from: `${month}-01`, to: last < today ? last : today };
}

export async function submitReview(
  input: { month: string; taxRate: number; signerId: string | null },
  actor: string,
): Promise<string> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new AccountsError("Pick a month");
  const { from, to } = asAt(input.month);
  if (from > todayLK()) throw new AccountsError("That month hasn't started yet");
  const taxRate = Math.min(100, Math.max(0, Number(input.taxRate) || 0));
  const snapshot = await reportData(from, to);
  const id = "sr_" + rid().slice(0, 10);

  await transaction(async (c) => {
    const pending = await c.query(
      `SELECT 1 FROM statement_reviews WHERE month = $1 AND status = 'pending' FOR UPDATE`,
      [input.month],
    );
    if (pending.rowCount) throw new AccountsError("This month is already waiting for approval");
    const inv = await c.query<{ id: string; name: string; share_pct: number }>(
      `SELECT id, name, share_pct FROM business_partners WHERE active AND share_pct > 0 ORDER BY sort_order`,
    );
    if (!inv.rowCount) throw new AccountsError("No investors with a share to approve it");
    const investors: Signer[] = inv.rows.map((r) => ({ id: r.id, name: r.name, sharePct: Number(r.share_pct) }));
    let signature: string | null = null;
    if (input.signerId) {
      const s = await c.query<{ signature_image: string | null }>(
        `SELECT signature_image FROM business_partners WHERE id = $1`,
        [input.signerId],
      );
      signature = s.rows[0]?.signature_image ?? null;
      if (!signature) throw new AccountsError("Add your signature on the Investors screen first");
    }
    await c.query(
      `INSERT INTO statement_reviews (id, month, period_from, period_to, tax_rate, snapshot, investors, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, input.month, from, to, taxRate, JSON.stringify(snapshot), JSON.stringify(investors), actor],
    );
    // the treasurer signs as they submit
    if (input.signerId && investors.some((i) => i.id === input.signerId)) {
      await c.query(
        `INSERT INTO statement_approvals (review_id, partner_id, decision, signature) VALUES ($1,$2,'approve',$3)`,
        [id, input.signerId, signature],
      );
      if (investors.length === 1)
        await c.query(`UPDATE statement_reviews SET status='approved', completed_at=now() WHERE id=$1`, [id]);
    }
  });
  await audit(actor, "accounts.statement.submit", "statement", id, `${input.month} balance sheet`);
  return id;
}

export async function decideReview(
  input: { id: string; partnerId: string; decision: "approve" | "reject"; note?: string },
  actor: string,
): Promise<void> {
  await transaction(async (c) => {
    const r = await c.query<{ status: string; investors: Signer[] }>(
      `SELECT status, investors FROM statement_reviews WHERE id = $1 FOR UPDATE`,
      [input.id],
    );
    const review = r.rows[0];
    if (!review) throw new AccountsError("Statement not found");
    if (review.status !== "pending") throw new AccountsError("This statement is no longer waiting for approval");
    if (!review.investors.some((i) => i.id === input.partnerId))
      throw new AccountsError("You're not one of the approvers for this statement");
    const done = await c.query(`SELECT 1 FROM statement_approvals WHERE review_id=$1 AND partner_id=$2`, [
      input.id,
      input.partnerId,
    ]);
    if (done.rowCount) throw new AccountsError("You've already responded to this statement");

    let signature: string | null = null;
    if (input.decision === "approve") {
      const s = await c.query<{ signature_image: string | null }>(
        `SELECT signature_image FROM business_partners WHERE id = $1`,
        [input.partnerId],
      );
      signature = s.rows[0]?.signature_image ?? null;
      if (!signature) throw new AccountsError("Add your signature on the Investors screen first");
    }
    await c.query(
      `INSERT INTO statement_approvals (review_id, partner_id, decision, note, signature) VALUES ($1,$2,$3,$4,$5)`,
      [input.id, input.partnerId, input.decision, (input.note ?? "").trim().slice(0, 300), signature],
    );
    if (input.decision === "reject") {
      await c.query(`UPDATE statement_reviews SET status='rejected', completed_at=now() WHERE id=$1`, [input.id]);
    } else {
      const n = await c.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM statement_approvals WHERE review_id=$1 AND decision='approve'`,
        [input.id],
      );
      if (Number(n.rows[0].n) >= review.investors.length)
        await c.query(`UPDATE statement_reviews SET status='approved', completed_at=now() WHERE id=$1`, [input.id]);
    }
  });
  await audit(actor, `accounts.statement.${input.decision}`, "statement", input.id, input.note ?? "");
}

export async function cancelReview(id: string, actor: string, isAdmin: boolean): Promise<void> {
  const rows = await query<{ submitted_by: string }>(`SELECT submitted_by FROM statement_reviews WHERE id=$1`, [id]);
  if (!rows[0]) return;
  if (!isAdmin && rows[0].submitted_by !== actor) throw new AccountsError("Only whoever submitted it can withdraw it");
  await query(`DELETE FROM statement_reviews WHERE id=$1`, [id]);
  await audit(actor, "accounts.statement.cancel", "statement", id, "");
}
