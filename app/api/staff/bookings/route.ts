import { NextRequest, NextResponse } from "next/server";
import {
  LoggedVisitInput,
  StaffBookingInput,
  WalkInSessionInput,
  validateStaffBooking,
} from "@/lib/booking";
import {
  BadTimeRange,
  BookingConflict,
  NotOpenSession,
  UnknownTable,
  cancelBooking,
  closeSession,
  createStaffBooking,
  deleteBooking,
  extendBooking,
  listBookings,
  logCompletedVisit,
  setBookingPayment,
  startWalkInSession,
} from "@/lib/db";
import { staffActor } from "@/lib/ecosystem/identity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await staffActor(req)))
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const date = sp.get("date");
  const status = sp.get("status");
  const open = sp.get("open");
  try {
    const bookings = await listBookings({
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      status:
        status === "CONFIRMED" || status === "CANCELLED" || status === "PENDING"
          ? status
          : undefined,
      open: open === "1" || open === "true",
    });
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error("staff bookings list error", err);
    return NextResponse.json({ error: "Could not load bookings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor)
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode =
    body.mode === "session"
      ? "session"
      : body.mode === "logged"
        ? "logged"
        : "booking";

  try {
    if (mode === "logged") {
      if (!body.tableId)
        return NextResponse.json({ error: "Pick a table." }, { status: 422 });
      if (!String(body.customerName ?? "").trim())
        return NextResponse.json(
          { error: "Enter the customer's name." },
          { status: 422 },
        );
      if (!body.startAt || !body.endAt)
        return NextResponse.json(
          { error: "Enter the start and leaving time." },
          { status: 422 },
        );
      const input: LoggedVisitInput = {
        tableId: String(body.tableId),
        customerName: String(body.customerName),
        phone: body.phone ? String(body.phone) : undefined,
        partySize: Number(body.partySize) || 2,
        playerId: body.playerId ? String(body.playerId) : null,
        notes: body.notes ? String(body.notes) : undefined,
        startAt: String(body.startAt),
        endAt: String(body.endAt),
        amount:
          body.amount != null && body.amount !== ""
            ? Number(body.amount)
            : undefined,
        paid: body.paid !== false,
      };
      const booking = await logCompletedVisit(input, actor);
      return NextResponse.json({ booking }, { status: 201 });
    }

    if (mode === "session") {
      if (!body.tableId)
        return NextResponse.json({ error: "Pick a table." }, { status: 422 });
      if (!String(body.customerName ?? "").trim())
        return NextResponse.json(
          { error: "Enter the customer's name." },
          { status: 422 },
        );
      const input: WalkInSessionInput = {
        tableId: String(body.tableId),
        customerName: String(body.customerName),
        phone: body.phone ? String(body.phone) : undefined,
        partySize: Number(body.partySize) || 2,
        playerId: body.playerId ? String(body.playerId) : null,
        notes: body.notes ? String(body.notes) : undefined,
      };
      const booking = await startWalkInSession(input, actor);
      return NextResponse.json({ booking }, { status: 201 });
    }

    const draft: Partial<StaffBookingInput> = {
      tableId: body.tableId,
      customerName: body.customerName,
      phone: body.phone,
      email: body.email,
      date: body.date,
      startTime: body.startTime,
      durationHrs: Number(body.durationHrs),
      partySize: Number(body.partySize),
      notes: body.notes,
      playerId: body.playerId ?? null,
      origin: body.origin === "walk_in" ? "walk_in" : "staff",
    };
    const err = validateStaffBooking(draft);
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const booking = await createStaffBooking(draft as StaffBookingInput, actor);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingConflict)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof BadTimeRange)
      return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof UnknownTable)
      return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("staff booking create error", e);
    return NextResponse.json({ error: "Could not save the booking" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor)
    return NextResponse.json({ error: "Staff only" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  try {
    switch (body.action) {
      case "cancel": {
        const booking = await cancelBooking(id, actor);
        if (!booking)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ booking });
      }
      case "extend": {
        const addHours = Number(body.addHours);
        if (!(addHours > 0))
          return NextResponse.json(
            { error: "Pick how many extra hours to add." },
            { status: 422 },
          );
        const booking = await extendBooking(
          id,
          addHours,
          {
            paymentStatus:
              body.paymentStatus === "paid"
                ? "paid"
                : body.paymentStatus === "unpaid"
                  ? "unpaid"
                  : undefined,
          },
          actor,
        );
        return NextResponse.json({ booking });
      }
      case "checkout": {
        const booking = await closeSession(
          id,
          {
            checkedOutAt: body.checkedOutAt || undefined,
            totalAmount:
              body.totalAmount != null ? Number(body.totalAmount) : undefined,
            paymentStatus: body.paymentStatus === "unpaid" ? "unpaid" : "paid",
          },
          actor,
        );
        return NextResponse.json({ booking });
      }
      case "pay":
      case "unpay": {
        const booking = await setBookingPayment(
          id,
          body.action === "pay" ? "paid" : "unpaid",
          actor,
        );
        if (!booking)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ booking });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 422 });
    }
  } catch (e) {
    if (e instanceof NotOpenSession)
      return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof UnknownTable)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("staff booking patch error", e);
    return NextResponse.json({ error: "Could not update the booking" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor)
    return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });
  await deleteBooking(id, actor);
  return NextResponse.json({ ok: true });
}
