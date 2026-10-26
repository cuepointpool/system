/* Builds the signed balance-sheet PDF in the browser from a review's frozen
   figures. Vector text (crisp, small) with each investor's transparent
   signature stamped in the approval block. Nothing is stored server-side. */

import { balanceSheetFigures, type ReportData } from "@/lib/accounts-reports";

export type PdfSigner = { id: string; name: string; sharePct: number };
export type PdfSignature = { image: string | null; at: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${FULL_MONTHS[m - 1]} ${y}`;
};
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
const fmt = (v: number) => {
  const r = Math.round(v) || 0;
  const s = Math.abs(r).toLocaleString("en-LK");
  return r < 0 ? `(${s})` : s;
};

export async function downloadBalanceSheetPdf(opts: {
  reviewId: string;
  month: string;
  snapshot: ReportData;
  taxRate: number;
  investors: PdfSigner[];
  signed: Record<string, PdfSignature>;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 20;
  const R = 190;
  const COL_A = 150; // right edge of the inner column
  const COL_B = R; // right edge of the totals column
  const ink: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  const teal: [number, number, number] = [0, 164, 143];
  let y = 22;

  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 22;
    }
  };

  /* header */
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ink);
  doc.text("CUE POINT", L, y, { charSpace: 1.2 });
  doc.setFontSize(13).text("Balance Sheet", R, y, { align: "right" });
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...muted);
  doc.text("Pool & Billiards · Pitipana, Homagama", L, y);
  doc.text(`As at ${longDate(opts.snapshot.to)}`, R, y, { align: "right" });
  y += 4.2;
  doc.setFontSize(7.5).text("Amounts in Sri Lankan Rupees (LKR)", R, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...ink).setLineWidth(0.6).line(L, y, R, y);
  y += 9;

  /* rows */
  const section = (t: string) => {
    ensure(12);
    y += 2;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...teal);
    doc.text(t.toUpperCase(), L, y, { charSpace: 0.6 });
    y += 6;
  };
  const row = (label: string, v: number | null, o: { col?: "a" | "b"; bold?: boolean; indent?: number; muted?: boolean; rule?: "single" | "double" } = {}) => {
    ensure(8);
    const x = o.col === "b" ? COL_B : COL_A;
    if (o.rule) {
      doc.setDrawColor(...(o.rule === "double" ? ink : ([203, 213, 225] as [number, number, number]))).setLineWidth(0.3);
      doc.line(x - 32, y - 4.2, x, y - 4.2);
    }
    doc.setFont("helvetica", o.bold ? "bold" : "normal").setFontSize(10).setTextColor(...(o.muted ? muted : ink));
    doc.text(label, L + (o.indent ?? 1) * 4.5, y);
    if (v !== null) doc.text(fmt(v), x, y, { align: "right" });
    if (o.rule === "double") {
      doc.line(x - 32, y + 1.6, x, y + 1.6);
      doc.line(x - 32, y + 2.4, x, y + 2.4);
    }
    y += o.rule ? 7.5 : 6;
  };

  const f = balanceSheetFigures(opts.snapshot, opts.taxRate);

  section("Assets");
  doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...muted);
  doc.text("Current assets", L + 4.5, y);
  y += 5.5;
  row("Cash in hand (cash box)", f.cash, { indent: 2 });
  row("Cash at bank", f.bank, { indent: 2 });
  row("Total assets", f.assets, { col: "b", bold: true, indent: 0, rule: "double" });

  section("Liabilities");
  if (opts.taxRate) row(`Income tax payable (@ ${opts.taxRate}%, less tax paid)`, f.taxPayable);
  else row("No liabilities recorded", 0, { muted: true });
  row("Total liabilities", f.taxPayable, { col: "b", indent: 0, rule: "single" });

  section("Investors' equity");
  row("Opening balances brought forward", f.opening);
  row("Capital introduced", f.capital);
  row(`Retained ${f.retained >= 0 ? "profit" : "loss"}${opts.taxRate ? " (after tax)" : ""}`, f.retained);
  row("Less: investor withdrawals", -f.drawings);
  row("Total equity", f.equity, { col: "b", bold: true, indent: 0, rule: "single" });
  y += 2;
  row("Total liabilities & equity", f.equity + f.taxPayable, { col: "b", bold: true, indent: 0, rule: "double" });

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...(f.balanced ? teal : ([225, 29, 72] as [number, number, number])));
  doc.text(f.balanced ? "Balanced — assets equal liabilities plus equity." : "Not balanced — check entries.", L, y);
  y += 8;

  section("Equity by investor");
  for (const p of opts.investors) {
    ensure(7);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink);
    doc.text(p.name, L, y);
    doc.setTextColor(...muted).text(`${p.sharePct}%`, COL_A - 14, y, { align: "right" });
    doc.setTextColor(...ink).text(fmt(Math.round((f.equity * p.sharePct) / 100)), COL_B, y, { align: "right" });
    doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(L, y + 2, R, y + 2);
    y += 6.5;
  }

  /* approvals */
  const boxH = 34;
  ensure(18 + Math.ceil(opts.investors.length / 2) * boxH);
  y += 6;
  section("Approval");
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  doc.text("We, the investors of Cue Point, have reviewed and approve this statement.", L, y);
  y += 6;
  const colW = (R - L - 12) / 2;
  for (let i = 0; i < opts.investors.length; i++) {
    const p = opts.investors[i];
    const x = L + (i % 2) * (colW + 12);
    const top = y + Math.floor(i / 2) * boxH;
    const lineY = top + 18;
    const s = opts.signed[p.id];
    if (s?.image) {
      try {
        const props = doc.getImageProperties(s.image);
        const h = Math.min(16, (props.height / props.width) * 60);
        const w = (props.width / props.height) * h;
        doc.addImage(s.image, "PNG", x + 1, lineY - h - 0.5, Math.min(w, colW - 2), h, undefined, "FAST");
      } catch {
        /* a broken image shouldn't stop the PDF */
      }
    }
    doc.setDrawColor(51, 65, 85).setLineWidth(0.3).line(x, lineY, x + colW, lineY);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text(p.name, x, lineY + 5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...muted);
    doc.text(`Investor · ${p.sharePct}%`, x, lineY + 9.5);
    doc.text(s ? `Approved ${stamp(s.at)}` : "Date: ____________", x + colW, lineY + 9.5, { align: "right" });
  }
  y += Math.ceil(opts.investors.length / 2) * boxH + 4;

  /* footer on every page */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(L, 287, R, 287);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...muted);
    doc.text(`Signed electronically by all ${opts.investors.length} investors · ref ${opts.reviewId}`, L, 291);
    doc.text(`Page ${i} of ${pages}`, R, 291, { align: "right" });
  }

  const [yy, mm] = opts.month.split("-").map(Number);
  doc.save(`Cue-Point-Balance-Sheet-${MONTHS[mm - 1]}-${yy}.pdf`);
}
