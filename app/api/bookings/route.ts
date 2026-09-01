import { NextRequest, NextResponse } from "next/server";
import { BookingInput, validateBooking } from "@/lib/booking";
import { BookingConflict, UnknownTable, createBooking, listBookings } from "@/lib/db";
import { getViewer } from "@/lib/ecosystem/identity";
import { getTableById } from "@/lib/tables";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = process.env.ADMIN_KEY;
  if (key && req.headers.get("x-admin-key") !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const bookings = await listBookings();
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error("list bookings error", err);
    return NextResponse.json({ error: "Could not load bookings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Online booking is members-only — you must be signed in as a player.
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to your Cue Point account to book online." },
      { status: 401 },
    );
  }
  if (viewer.role !== "player") {
    return NextResponse.json(
      { error: "Staff assign tables from the operations console." },
      { status: 403 },
    );
  }

  let body: Partial<BookingInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // fall back to the member's own name / email when not supplied
  if (!body.customerName?.trim()) body.customerName = viewer.fullName;
  if (!body.email?.trim() && viewer.email) body.email = viewer.email;

  const err = validateBooking(body);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  if (!(await getTableById(String(body.tableId))))
    return NextResponse.json({ error: "Pick a table." }, { status: 422 });

  const input: BookingInput = {
    tableId: body.tableId!,
    customerName: body.customerName!,
    phone: body.phone!,
    email: body.email,
    date: body.date!,
    startTime: body.startTime!,
    durationHrs: Number(body.durationHrs),
    partySize: Number(body.partySize),
    notes: body.notes,
    playerId: viewer.id,
  };

  try {
    const booking = await createBooking(input);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    if (e instanceof BookingConflict) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof UnknownTable) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("create booking error", e);
    return NextResponse.json({ error: "Something went wrong creating the booking" }, { status: 500 });
  }
}
