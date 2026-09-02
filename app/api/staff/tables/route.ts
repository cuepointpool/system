import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  createTable,
  deleteTable,
  listTables,
  updateTable,
} from "@/lib/tables";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  return NextResponse.json({ tables: await listTables({ includeInactive: true }) });
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!String(body.label ?? "").trim())
    return NextResponse.json({ error: "A table name is required" }, { status: 422 });
  const table = await createTable(
    {
      label: String(body.label),
      area: body.area,
      note: body.note,
      seats: body.seats,
    },
    actor,
  );
  return NextResponse.json({ ok: true, table }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  const table = await updateTable(
    String(body.id),
    {
      label: body.label,
      area: body.area,
      note: body.note,
      seats: body.seats,
      active: body.active,
      bookable: body.bookable,
      sortOrder: body.sortOrder,
    },
    actor,
  );
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  return NextResponse.json({ ok: true, table });
}

export async function DELETE(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  await deleteTable(id, actor);
  return NextResponse.json({ ok: true });
}
