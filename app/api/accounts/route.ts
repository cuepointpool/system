import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { accountsEditor, accountsViewer, partnerViewer } from "@/lib/partners";
import { listTables } from "@/lib/tables";
import {
  AccountsError,
  addEntry,
  balances,
  dayBook,
  deleteEntry,
  listEntries,
  listLog,
  listPartners,
  overview,
  reportData,
  setCashBox,
  todayLK,
  updateEntry,
  type EntryInput,
} from "@/lib/accounts";
import { ENTRY_KINDS, type EntryKind } from "@/lib/accounts-categories";

export const dynamic = "force-dynamic";

const MAX_RECEIPT_BYTES = 8_000_000; // ~8MB of base64 (~6MB file)
const RECEIPT_DATA_URL = /^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (error: string, status = 422) => NextResponse.json({ error }, { status });

function handle(err: unknown, what: string) {
  if (err instanceof AccountsError) return fail(err.message);
  console.error(`accounts ${what} error`, err);
  return fail("Something went wrong", 500);
}

/** One GET per screen: ?view=meta | overview | day | report | ledger | log */
export async function GET(req: NextRequest) {
  if (!(await accountsViewer(req))) return fail("Not authorized", 403);
  const sp = new URL(req.url).searchParams;
  const view = sp.get("view") ?? "overview";
  const date = (k: string, d: string) => {
    const v = sp.get(k);
    return v && DATE_RE.test(v) ? v : d;
  };
  try {
    switch (view) {
      case "meta": {
        const [isAdmin, canEdit, partners, tables, partner] = await Promise.all([
          adminActor(req),
          accountsEditor(req),
          listPartners(),
          listTables(),
          partnerViewer(),
        ]);
        return NextResponse.json({
          today: todayLK(),
          access: {
            isAdmin: !!isAdmin,
            canEdit: !!canEdit,
            // the signed-in investor (null for admins)
            partnerId: isAdmin ? null : (partner?.id ?? null),
            // the treasurer prepares statements for sign-off
            canSubmitStatements: !!isAdmin || !!partner?.positions.includes("treasurer"),
          },
          partners: partners
            .filter((p) => isAdmin || p.active)
            .map((p) =>
              isAdmin ? p : { ...p, username: null, positions: p.positions },
            ),
          tables: tables.map((t) => ({ id: t.id, label: t.label })),
        });
      }
      case "overview":
        return NextResponse.json(await overview(date("today", todayLK())));
      case "day":
        return NextResponse.json(await dayBook(date("date", todayLK())));
      case "report": {
        const today = todayLK();
        return NextResponse.json(
          await reportData(date("from", today.slice(0, 8) + "01"), date("to", today)),
        );
      }
      case "log": {
        // who changed what — admins only
        if (!(await adminActor(req))) return fail("Admins only", 403);
        return NextResponse.json({ log: await listLog() });
      }
      case "ledger": {
        const kind = sp.get("kind");
        const from = sp.get("from") && DATE_RE.test(sp.get("from")!) ? sp.get("from")! : undefined;
        const [entries, opening] = await Promise.all([
          listEntries({
            from,
            to: sp.get("to") && DATE_RE.test(sp.get("to")!) ? sp.get("to")! : undefined,
            kind: (ENTRY_KINDS as readonly string[]).includes(kind ?? "")
              ? (kind as EntryKind)
              : undefined,
          }),
          // balance brought forward into the range
          from ? balances({ before: from }) : Promise.resolve({ cash: 0, bank: 0 }),
        ]);
        return NextResponse.json({ entries, opening });
      }
      default:
        return fail("Unknown view");
    }
  } catch (err) {
    return handle(err, "GET");
  }
}

export async function POST(req: NextRequest) {
  const actor = await accountsEditor(req);
  if (!actor) return fail("You have view-only access to the accounts", 403);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "cashbox") {
      if (body.phase !== "open" && body.phase !== "close") return fail("Open or close?");
      const cashDay = await setCashBox(
        {
          date: String(body.date ?? ""),
          phase: body.phase,
          amount:
            body.amount === null || body.amount === "" || body.amount === undefined
              ? null
              : Number(body.amount),
          note: body.note ? String(body.note) : "",
        },
        actor,
      );
      return NextResponse.json({ cashDay }, { status: 201 });
    }

    const receipt = body.receiptImage ? String(body.receiptImage) : null;
    if (receipt && !RECEIPT_DATA_URL.test(receipt))
      return fail("Receipt must be a PNG, JPG, WebP image or a PDF");
    if (receipt && receipt.length > MAX_RECEIPT_BYTES)
      return fail("Receipt file is too large (max ~6MB)");
    const input: EntryInput = {
      date: String(body.date ?? ""),
      kind: body.kind,
      category: body.category ? String(body.category) : "",
      description: body.description ? String(body.description) : "",
      tableId: body.tableId ? String(body.tableId) : null,
      tableName: body.tableName ? String(body.tableName) : null,
      startTime: body.startTime ? String(body.startTime) : null,
      endTime: body.endTime ? String(body.endTime) : null,
      minutes: body.minutes == null ? null : Number(body.minutes),
      partnerId: body.partnerId ? String(body.partnerId) : null,
      cash: Number(body.cash) || 0,
      bank: Number(body.bank) || 0,
      receiptImage: receipt,
    };
    const entry = await addEntry(input, actor);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return handle(err, "POST");
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await accountsEditor(req);
  if (!actor) return fail("You have view-only access to the accounts", 403);
  const body = await req.json().catch(() => ({}));
  if (!body.id) return fail("Missing entry id");
  const pick = <T,>(k: string, f: (v: unknown) => T): T | undefined =>
    body[k] === undefined ? undefined : f(body[k]);
  try {
    const entry = await updateEntry(
      String(body.id),
      {
        date: pick("date", String),
        category: pick("category", String),
        description: pick("description", String),
        cash: pick("cash", Number),
        bank: pick("bank", Number),
        tableId: pick("tableId", (v) => (v ? String(v) : null)),
        tableName: pick("tableName", (v) => (v ? String(v) : null)),
        startTime: pick("startTime", (v) => (v ? String(v) : null)),
        endTime: pick("endTime", (v) => (v ? String(v) : null)),
        minutes: pick("minutes", (v) => (v == null ? null : Number(v))),
        partnerId: pick("partnerId", (v) => (v ? String(v) : null)),
      },
      actor,
    );
    return NextResponse.json({ entry });
  } catch (err) {
    return handle(err, "PATCH");
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await accountsEditor(req);
  if (!actor) return fail("You have view-only access to the accounts", 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Missing id");
  try {
    await deleteEntry(id, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err, "DELETE");
  }
}
