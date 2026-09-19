/* Shared plumbing for the /api/friends/* route handlers. */

import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "../ecosystem/identity";
import { rateLimit, tooLarge } from "../rate-limit";
import { FriendsError, type Actor } from "./store";

export async function getActor(): Promise<Actor | null> {
  const v = await getViewer();
  return v ? { id: v.id, role: v.role, nickname: v.nickname } : null;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(err: unknown) {
  if (err instanceof FriendsError) {
    return json({ error: err.message, ...(err.data ? { details: err.data } : {}) }, err.status);
  }
  const code = (err as { code?: string })?.code;
  if (code === "40P01" || code === "40001") {
    return json({ error: "That was busy — please try again." }, 409);
  }
  console.error("[friends] unexpected error", err);
  return json({ error: "Something went wrong." }, 500);
}

/** run a handler for a signed-in viewer, mapping FriendsError to JSON */
export async function withActor(
  req: NextRequest,
  opts: { write?: boolean },
  fn: (actor: Actor) => Promise<NextResponse>,
): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return json({ error: "Sign in to play with friends." }, 401);
  if (opts.write) {
    const big = tooLarge(req, 16_384);
    if (big) return big;
    const limited = rateLimit(`fplay:${actor.id}`, 120, 60_000);
    if (limited) return limited;
  }
  try {
    return await fn(actor);
  } catch (err) {
    return fail(err);
  }
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : [];
