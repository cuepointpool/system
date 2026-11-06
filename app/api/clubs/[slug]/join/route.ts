import { NextRequest, NextResponse } from "next/server";
import { cancelJoinRequest, ClubError, getClubIdBySlug, requestToJoin } from "@/lib/clubs/store";
import { getViewer } from "@/lib/ecosystem/identity";
import { rateLimit, tooLarge } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** POST { message? } = ask to join · DELETE = take the request back (signed-in players) */
async function handle(req: NextRequest, slug: string, cancel: boolean) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Sign in to your Cue Point account first." }, 401);
  const big = tooLarge(req, 4096);
  if (big) return big;
  const limited = rateLimit(`clubjoin:${viewer.id}`, 20, 60_000);
  if (limited) return limited;
  const clubId = await getClubIdBySlug(slug);
  if (!clubId) return json({ error: "Club not found" }, 404);
  try {
    if (cancel) await cancelJoinRequest(clubId, viewer.id);
    else {
      const b = await req.json().catch(() => ({}));
      await requestToJoin(clubId, viewer.id, b?.message);
    }
    return json({ ok: true });
  } catch (err) {
    if (err instanceof ClubError) return json({ error: err.message }, err.status);
    console.error("[club join]", err);
    return json({ error: "Something went wrong." }, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(req, (await params).slug, false);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(req, (await params).slug, true);
}
