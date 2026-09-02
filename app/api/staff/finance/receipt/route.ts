import { NextRequest, NextResponse } from "next/server";
import { getExpenseReceipt } from "@/lib/finance";
import { financeViewer } from "@/lib/partners";

export const dynamic = "force-dynamic";

/** Serves an expense's receipt image so `<img src>` can render it directly. */
export async function GET(req: NextRequest) {
  if (!(await financeViewer(req)))
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 422 });

  const dataUrl = await getExpenseReceipt(id);
  if (!dataUrl)
    return NextResponse.json({ error: "No receipt" }, { status: 404 });

  const m = /^data:(image\/[a-z+]+|application\/pdf);base64,(.*)$/i.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Bad receipt" }, { status: 500 });
  const buf = Buffer.from(m[2], "base64");
  const ext =
    m[1] === "application/pdf" ? "pdf" : m[1].split("/")[1].replace("jpeg", "jpg");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": m[1],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="receipt-${id}.${ext}"`,
    },
  });
}
