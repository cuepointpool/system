import { NextRequest, NextResponse } from "next/server";
import { AvatarError, MAX_AVATAR_BYTES, removeAvatar, setAvatar } from "@/lib/avatars";
import { getViewer } from "@/lib/ecosystem/identity";
import { rateLimit, tooLarge } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST { image: "data:image/…;base64,…" } — set the signed-in player's photo. */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const big = tooLarge(req, Math.ceil(MAX_AVATAR_BYTES * 1.4) + 1024);
  if (big) return big;
  const limited = rateLimit(`avatar:${viewer.id}`, 20, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  try {
    const avatar = await setAvatar(viewer.id, String(body.image ?? ""));
    return NextResponse.json({ avatar });
  } catch (err) {
    if (err instanceof AvatarError)
      return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("avatar upload error", err);
    return NextResponse.json({ error: "Could not save the photo" }, { status: 500 });
  }
}

export async function DELETE() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  await removeAvatar(viewer.id);
  return NextResponse.json({ avatar: null });
}
