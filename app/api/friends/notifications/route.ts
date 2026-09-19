import { NextRequest } from "next/server";
import { json, readBody, strList, withActor } from "@/lib/friends/http";
import { listNotifications, markNotificationsRead } from "@/lib/friends/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withActor(req, {}, async (actor) => json(await listNotifications(actor.id)));
}

/** mark some (ids) or all notifications as read */
export async function POST(req: NextRequest) {
  return withActor(req, { write: true }, async (actor) => {
    const body = await readBody(req);
    await markNotificationsRead(actor.id, strList(body.ids));
    return json({ ok: true });
  });
}
