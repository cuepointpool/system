"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReportData } from "@/lib/accounts-reports";
import { BalanceSheet, Paper, Signatures, type SignedBy } from "./Reports";
import { who } from "./ChangeLog";
import { downloadBalanceSheetPdf } from "./statementPdf";
import { Card, ErrorNote, Label, Toggle, longDate, useAccounts, useView, type Investor } from "./ui";

/* Monthly balance sheet sign-off: the treasurer submits, every investor
   types APPROVE to stamp their signature, then anyone downloads the PDF. */

const CONFIRM = "APPROVE";
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return `${FULL_MONTHS[mm - 1]} ${y}`;
};
const daysLeft = (iso: string) => Math.max(0, 7 - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

type Approval = { partnerId: string; decision: "approve" | "reject"; note: string; signature: string | null; at: string };
type Review = {
  id: string;
  month: string;
  from: string;
  to: string;
  taxRate: number;
  snapshot: ReportData;
  investors: { id: string; name: string; sharePct: number }[];
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  createdAt: string;
  completedAt: string | null;
  approvals: Approval[];
};

function useReviews() {
  const { headers, tick } = useAccounts();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [own, setOwn] = useState(0);
  const hk = JSON.stringify(headers);
  useEffect(() => {
    fetch("/api/accounts/statements", { headers: JSON.parse(hk), cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setReviews(d.reviews) : setErr(d.error || "Failed to load")))
      .catch(() => setErr("Failed to load"));
  }, [hk, tick, own]);
  return { reviews, err, reload: () => setOwn((n) => n + 1) };
}

function useStatementSend(onDone: () => void) {
  const { headers } = useAccounts();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useCallback(
    async (method: "POST" | "DELETE", body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res =
          method === "DELETE"
            ? await fetch(`/api/accounts/statements?id=${encodeURIComponent(String(body.id))}`, { method, headers })
            : await fetch("/api/accounts/statements", {
                method,
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not save");
        onDone();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [headers, onDone],
  );
  return { send, busy, error };
}

export function Approvals() {
  const { meta } = useAccounts();
  const { reviews, err, reload } = useReviews();
  const me = meta.partners.find((p) => p.id === meta.access.partnerId) ?? null;

  return (
    <div className="space-y-5">
      {me && !me.hasSignature && (
        <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
          Add your signature on the <b>Investors</b> screen first — it&apos;s stamped onto every statement you approve.
        </p>
      )}
      {meta.access.canSubmitStatements && <SubmitPanel me={me} onDone={reload} />}

      {!reviews ? (
        <p className="text-sm text-mist">{err ?? "Loading…"}</p>
      ) : reviews.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-mist">
            No statements waiting. {meta.access.canSubmitStatements ? "Submit a month above." : "The treasurer submits each month's balance sheet here."}
          </p>
        </Card>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} r={r} me={me} onDone={reload} />)
      )}
      <p className="text-[11px] text-mist">
        Statements are short-lived: signed or rejected ones are deleted after 7 days — download your copy.
      </p>
    </div>
  );
}

function SubmitPanel({ me, onDone }: { me: Investor | null; onDone: () => void }) {
  const { meta } = useAccounts();
  const [month, setMonth] = useState(meta.today.slice(0, 7));
  const [tax, setTax] = useState(false);
  const [rate, setRate] = useState("30");
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState(false);
  const { send, busy, error } = useStatementSend(onDone);

  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const to = last < meta.today ? last : meta.today;
  const { data } = useView<ReportData>(preview ? { view: "report", from: `${month}-01`, to } : null);
  const taxRate = tax ? Number(rate) || 0 : 0;
  const needsSign = !!me;
  const ok = !needsSign || (confirm.trim().toUpperCase() === CONFIRM && me!.hasSignature);

  return (
    <Card title="Submit a balance sheet for sign-off" sub="Figures are frozen when you submit. Every investor then approves it with their signature.">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <Label>Month</Label>
          <input type="month" value={month} max={meta.today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input h-10 w-44" />
        </label>
        <div className="pb-2.5">
          <Toggle on={tax} onChange={setTax} label="Include income tax" />
        </div>
        {tax && (
          <label className="block">
            <Label>Rate %</Label>
            <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className="input h-10 w-20 text-center" />
          </label>
        )}
        <button onClick={() => setPreview((v) => !v)} className="btn-ghost mb-0.5 px-4 py-2 text-xs">
          {preview ? "Hide preview" : "Preview"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-mist">
        Balance sheet as at <span className="text-white/85">{longDate(to)}</span>
        {to !== last && " (month not over yet — figures to today)"}.
      </p>

      {preview && (
        <div className="mt-5">
          {data ? (
            <Paper title="Balance Sheet" data={data} kind="bs" today={meta.today}>
              <BalanceSheet data={data} taxRate={taxRate} investors={meta.partners.filter((p) => p.active && p.sharePct > 0)} />
            </Paper>
          ) : (
            <p className="text-sm text-mist">Building preview…</p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/[0.07] pt-4">
        {needsSign && (
          <label className="block">
            <Label>Type {CONFIRM} to sign and submit</Label>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={CONFIRM} className="input h-10 w-48 font-semibold uppercase tracking-widest" />
          </label>
        )}
        <button
          disabled={busy || !ok}
          onClick={async () => {
            if (await send("POST", { action: "submit", month, taxRate, confirm })) setConfirm("");
          }}
          className="btn-primary px-5 py-2.5 text-xs disabled:opacity-40"
        >
          {busy ? "Submitting…" : needsSign ? "Sign & submit for approval" : "Submit for approval"}
        </button>
      </div>
      <div className="mt-3">
        <ErrorNote text={error} />
      </div>
    </Card>
  );
}

function ReviewCard({ r, me, onDone }: { r: Review; me: Investor | null; onDone: () => void }) {
  const { meta } = useAccounts();
  const [open, setOpen] = useState(r.status === "pending");
  const [confirm, setConfirm] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const { send, busy, error } = useStatementSend(onDone);

  const byId = new Map(r.approvals.map((a) => [a.partnerId, a]));
  const approved = r.approvals.filter((a) => a.decision === "approve").length;
  const mine = me ? byId.get(me.id) : undefined;
  const canRespond = r.status === "pending" && !!me && r.investors.some((i) => i.id === me.id) && !mine;
  const submitter = who(r.submittedBy);
  const mineSubmitted = me ? r.submittedBy === `partner:${me.username ?? me.name}` : false;
  const signed: SignedBy = Object.fromEntries(
    r.approvals.filter((a) => a.decision === "approve").map((a) => [a.partnerId, { image: a.signature, at: a.at }]),
  );
  const rejection = r.approvals.find((a) => a.decision === "reject");

  const download = async () => {
    setPdfBusy(true);
    try {
      await downloadBalanceSheetPdf({
        reviewId: r.id,
        month: r.month,
        snapshot: r.snapshot,
        taxRate: r.taxRate,
        investors: r.investors,
        signed,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-white">{monthName(r.month)} — balance sheet</p>
          <p className="text-[11px] text-mist">
            As at {longDate(r.to)} · submitted by {submitter.name} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {r.taxRate ? ` · tax @ ${r.taxRate}%` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium",
            r.status === "approved" ? "bg-teal/15 text-teal" : r.status === "rejected" ? "bg-rose-400/15 text-rose-200" : "bg-amber-400/15 text-amber-200",
          )}
        >
          {r.status === "approved" ? "✓ Approved by all" : r.status === "rejected" ? "Sent back" : `Waiting · ${approved} of ${r.investors.length} signed`}
        </span>
      </div>

      {/* who has signed */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${(approved / r.investors.length) * 100}%` }} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {r.investors.map((i) => {
          const a = byId.get(i.id);
          return (
            <div
              key={i.id}
              className={cn(
                "rounded-xl border px-3 py-2",
                a?.decision === "approve" ? "border-teal/30 bg-teal/[0.06]" : a?.decision === "reject" ? "border-rose-300/30 bg-rose-400/[0.06]" : "border-white/10",
              )}
            >
              <p className="truncate text-xs font-medium text-white">{i.name}</p>
              <p className={cn("text-[10px]", a?.decision === "approve" ? "text-teal" : a?.decision === "reject" ? "text-rose-200" : "text-mist")}>
                {a?.decision === "approve" ? "✓ Signed" : a?.decision === "reject" ? "✗ Sent back" : "Waiting"}
                {a && ` · ${new Date(a.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
              </p>
            </div>
          );
        })}
      </div>

      {rejection && (
        <p className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          <b>{r.investors.find((i) => i.id === rejection.partnerId)?.name}</b>: {rejection.note}
          <span className="block text-[10px] text-rose-200/70">Fix the entries, then the treasurer submits the month again.</span>
        </p>
      )}

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {canRespond && !rejecting && (
          <>
            <label className="block">
              <Label>Type {CONFIRM} to sign</Label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={CONFIRM} className="input h-10 w-44 font-semibold uppercase tracking-widest" />
            </label>
            <button
              disabled={busy || confirm.trim().toUpperCase() !== CONFIRM || !me!.hasSignature}
              onClick={() => send("POST", { action: "approve", id: r.id, confirm })}
              className="btn-primary px-5 py-2.5 text-xs disabled:opacity-40"
            >
              {busy ? "Signing…" : "Approve & sign"}
            </button>
            <button onClick={() => setRejecting(true)} className="btn-ghost px-4 py-2.5 text-xs">
              Send back…
            </button>
          </>
        )}
        {canRespond && rejecting && (
          <>
            <label className="block min-w-[240px] flex-1">
              <Label>What needs fixing?</Label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input h-10" />
            </label>
            <button
              disabled={busy || !note.trim()}
              onClick={() => send("POST", { action: "reject", id: r.id, note })}
              className="rounded-full border border-rose-300/40 bg-rose-400/15 px-5 py-2.5 text-xs text-rose-100 disabled:opacity-40"
            >
              Send back
            </button>
            <button onClick={() => setRejecting(false)} className="btn-ghost px-4 py-2.5 text-xs">
              Cancel
            </button>
          </>
        )}
        {r.status === "approved" && (
          <button onClick={download} disabled={pdfBusy} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-40">
            {pdfBusy ? "Preparing…" : "⬇ Download signed PDF"}
          </button>
        )}
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-4 py-2.5 text-xs">
          {open ? "Hide statement" : "View statement"}
        </button>
        {r.status === "pending" && (meta.access.isAdmin || mineSubmitted) && (
          <button
            disabled={busy}
            onClick={() => window.confirm("Withdraw this statement?") && send("DELETE", { id: r.id })}
            className="ml-auto text-[11px] text-mist hover:text-rose-200"
          >
            Withdraw
          </button>
        )}
      </div>
      {mine?.decision === "approve" && r.status === "pending" && <p className="mt-2 text-[11px] text-teal">✓ You signed this. Waiting for the others.</p>}
      {r.completedAt && r.status !== "pending" && (
        <p className="mt-2 text-[11px] text-mist">Deleted automatically in {daysLeft(r.completedAt)} day{daysLeft(r.completedAt) === 1 ? "" : "s"}.</p>
      )}
      <div className="mt-3">
        <ErrorNote text={error} />
      </div>

      {open && (
        <div className="mt-5">
          <Paper title="Balance Sheet" data={r.snapshot} kind="bs" today={r.createdAt.slice(0, 10)}>
            <BalanceSheet data={r.snapshot} taxRate={r.taxRate} investors={r.investors as Investor[]} />
            <Signatures investors={r.investors} signed={signed} />
          </Paper>
        </div>
      )}
    </Card>
  );
}
