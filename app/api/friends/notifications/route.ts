import { NextRequest } from "next/server";
import { json, readBody, str, strList, withActor } from "@/lib/friends/http";
import { clearNotifications, listNotifications, markNotificationsRead } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withActor(req, {}, async (actor) => json(await listNotifications(actor.id)));
}

/** mark read: some (ids), everything about one page (href), or all */
export async function POST(req: NextRequest) {
  return withActor(req, { write: true }, async (actor) => {
    const body = await readBody(req);
    await markNotificationsRead(actor.id, strList(body.ids), str(body.href) || undefined);
    return json({ ok: true });
  });
}

/** remove for good: some (ids) or all */
export async function DELETE(req: NextRequest) {
  return withActor(req, { write: true }, async (actor) => {
    const body = await readBody(req);
    await clearNotifications(actor.id, strList(body.ids));
    return json({ ok: true });
  });
}
