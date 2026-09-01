import { NextResponse } from "next/server";
import { getPlayerProfileView } from "@/lib/ecosystem/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const view = await getPlayerProfileView(slug);
  if (!view) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
