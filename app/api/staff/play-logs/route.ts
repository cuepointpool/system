import { NextRequest, NextResponse } from "next/server";
import {
  PlayLogError,
  createPlayLog,
  deletePlayLog,
  listPlayLogs,
  listReservations,
  playTimeFor,
} from "@/lib/play-logs";
import { adminActor, staffActor } from "@/lib/ecosystem/identity";

export const dynamic = "force-dynamic";

/** GET ?date=YYYY-MM-DD → that day's log + reservations; GET ?player=id → hours & free time. */
export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  try {
    const player = sp.get("player");
    if (player) return NextResponse.json({ playTime: await playTimeFor(player) });

    const date = sp.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return NextResponse.json({ error: "Pick a valid date." }, { status: 422 });
    const [logs, reservations] = await Promise.all([
      listPlayLogs(date),
      listReservations(date),
    ]);
    return NextResponse.json({ logs, reservations });
  } catch (err) {
    console.error("play log list error", err);
    return NextResponse.json({ error: "Could not load the daily log" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  try {
    const log = await createPlayLog(
      {
        date: String(b.date ?? ""),
        tableId: String(b.tableId ?? ""),
        startTime: String(b.startTime ?? ""),
        endTime: String(b.endTime ?? ""),
        playerId: b.playerId ? String(b.playerId) : null,
        customerName: b.customerName ? String(b.customerName) : "",
        bookingId: b.bookingId ? String(b.bookingId) : null,
        freeMin: Number(b.freeMin) || 0,
        discount: Number(b.discount) || 0,
        notes: b.notes ? String(b.notes) : undefined,
      },
      actor,
    );
    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    if (err instanceof PlayLogError)
      return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("play log create error", err);
    return NextResponse.json({ error: "Could not save the entry" }, { status: 500 });
  }
}

/** Removing income is admin-only. */
export async function DELETE(req: NextRequest) {
  const actor = await adminActor(req);
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  try {
    await deletePlayLog(id, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("play log delete error", err);
    return NextResponse.json({ error: "Could not delete the entry" }, { status: 500 });
  }
}
