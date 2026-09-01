import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { getExpenseReceipt } from "@/lib/finance";

export const dynamic = "force-dynamic";

/** Serves an expense's receipt image so `<img src>` can render it directly. */
export async function GET(req: NextRequest) {
  if (!(await adminActor(req)))
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  const dataUrl = await getExpenseReceipt(id);
  if (!dataUrl)
    return NextResponse.json({ error: "No receipt" }, { status: 404 });

  const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Bad receipt" }, { status: 500 });
  const buf = Buffer.from(m[2], "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="receipt-${id}"`,
    },
  });
}
