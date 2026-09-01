import { NextRequest, NextResponse } from "next/server";
import { getDayAvailability, getFloorAvailability } from "@/lib/db";
import { getTableById } from "@/lib/tables";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";
  const table = searchParams.get("table") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    // No `table` param → whole-floor view: every table + its booked times.
    if (!table) {
      const floor = await getFloorAvailability(date);
      return NextResponse.json(floor);
    }

    if (!(await getTableById(table))) {
      return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    }
    const data = await getDayAvailability(date, table);
    return NextResponse.json(data);
  } catch (err) {
    console.error("availability error", err);
    return NextResponse.json(
      { error: "Could not load availability" },
      { status: 500 },
    );
  }
}
