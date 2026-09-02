import { NextResponse } from "next/server";
import { TABLE_HOURLY_RATE } from "@/lib/config";
import { listTables } from "@/lib/tables";

export const dynamic = "force-dynamic";

/** Public: the active floor tables the booking flow renders. */
export async function GET() {
  try {
    const tables = await listTables();
    return NextResponse.json({
      hourlyRate: TABLE_HOURLY_RATE,
      tables: tables.map((t) => ({
        id: t.id,
        label: t.label,
        area: t.area,
        note: t.note,
        seats: t.seats,
        bookable: t.bookable,
      })),
    });
  } catch (err) {
    console.error("list tables error", err);
    return NextResponse.json({ error: "Could not load tables" }, { status: 500 });
  }
}
