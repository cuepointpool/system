import { NextRequest, NextResponse } from "next/server";
import { getAvatar } from "@/lib/avatars";

export const dynamic = "force-dynamic";

/** Serves a player's photo. The version is in the path, so each upload gets a
 *  new URL and the response can be cached forever. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; v: string }> },
) {
  const { id, v } = await ctx.params;
  const a = await getAvatar(id);
  if (!a || a.version !== v) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Length": String(a.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
