import { NextRequest, NextResponse } from "next/server";
import { financeEditor, financeViewer } from "@/lib/partners";
import {
  addContribution,
  addExpense,
  createPartner,
  deleteContribution,
  deleteExpense,
  deletePartner,
  financeSummary,
  listCashDays,
  listContributions,
  listExpenses,
  listPartners,
  setCashPhase,
  updatePartner,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

const MAX_RECEIPT_BYTES = 4_000_000; // ~4MB of base64

export async function GET(req: NextRequest) {
  if (!(await financeViewer(req)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const [partners, contributions, expenses, cashDays, summary] =
      await Promise.all([
        listPartners(),
        listContributions(),
        listExpenses(),
        listCashDays(),
        financeSummary(),
      ]);
    return NextResponse.json({
      partners,
      contributions,
      expenses,
      cashDays,
      summary,
    });
  } catch (err) {
    console.error("finance GET error", err);
    return NextResponse.json({ error: "Could not load finance" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await financeEditor(req);
  if (!actor)
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  try {
    switch (body.kind) {
      case "partner": {
        if (!String(body.name ?? "").trim())
          return NextResponse.json({ error: "Name is required" }, { status: 422 });
        const partner = await createPartner(String(body.name), actor);
        return NextResponse.json({ partner }, { status: 201 });
      }
      case "contribution": {
        if (!body.partnerId || !(Number(body.amount) > 0))
          return NextResponse.json(
            { error: "Pick a partner and an amount" },
            { status: 422 },
          );
        await addContribution(
          {
            partnerId: String(body.partnerId),
            amount: Number(body.amount),
            note: body.note ? String(body.note) : "",
            at: body.at ? String(body.at) : undefined,
          },
          actor,
        );
        return NextResponse.json({ ok: true }, { status: 201 });
      }
      case "expense": {
        if (!String(body.category ?? "").trim() || !(Number(body.amount) > 0))
          return NextResponse.json(
            { error: "Category and amount are required" },
            { status: 422 },
          );
        const receipt = body.receiptImage ? String(body.receiptImage) : null;
        if (receipt && !/^data:image\/(png|jpe?g|webp);base64,/.test(receipt))
          return NextResponse.json(
            { error: "Receipt must be a PNG, JPG or WebP image" },
            { status: 422 },
          );
        if (receipt && receipt.length > MAX_RECEIPT_BYTES)
          return NextResponse.json(
            { error: "Receipt image is too large (max ~3MB)" },
            { status: 422 },
          );
        const expense = await addExpense(
          {
            category: String(body.category),
            description: body.description ? String(body.description) : "",
            amount: Number(body.amount),
            source: body.source === "capital" ? "capital" : "revenue",
            spentAt: body.spentAt ? String(body.spentAt) : undefined,
            receiptImage: receipt,
          },
          actor,
        );
        return NextResponse.json({ expense }, { status: 201 });
      }
      case "cash": {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? "")) ||
          (body.phase !== "open" && body.phase !== "close") ||
          !(Number(body.amount) >= 0)
        )
          return NextResponse.json(
            { error: "Need a date, phase and amount" },
            { status: 422 },
          );
        const cashDay = await setCashPhase(
          {
            date: String(body.date),
            phase: body.phase,
            amount: Number(body.amount),
            type: body.type ? String(body.type) : "",
            note: body.note ? String(body.note) : "",
          },
          actor,
        );
        return NextResponse.json({ cashDay }, { status: 201 });
      }
      default:
        return NextResponse.json({ error: "Unknown kind" }, { status: 422 });
    }
  } catch (err) {
    console.error("finance POST error", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await financeEditor(req);
  if (!actor)
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.kind !== "partner" || !body.id)
    return NextResponse.json({ error: "Unsupported" }, { status: 422 });
  await updatePartner(
    String(body.id),
    { name: body.name, active: body.active },
    actor,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const actor = await financeEditor(req);
  if (!actor)
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const id = sp.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  try {
    if (kind === "expense") await deleteExpense(id, actor);
    else if (kind === "contribution") await deleteContribution(id, actor);
    else if (kind === "partner") await deletePartner(id, actor);
    else return NextResponse.json({ error: "Unknown kind" }, { status: 422 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("finance DELETE error", err);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
}
