import { NextRequest } from "next/server";
import { getActor, json } from "@/lib/friends/http";
import { subscribe } from "@/lib/friends/realtime";
import { canSubscribe } from "@/lib/friends/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 15_000; // keeps nginx / CloudFront from timing the stream out
const MAX_AGE_MS = 25 * 60_000; // recycle; the client reconnects and refetches

/**
 * Server-Sent Events: "topic X changed" signals only. Always includes the
 * viewer's own `user:` topic; `?topics=game:ID,tournament:ID` adds detail
 * topics, each authorised before it is accepted.
 */
export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return json({ error: "Sign in first." }, 401);

  const topics = new Set<string>([`user:${actor.id}`]);
  const wanted = (new URL(req.url).searchParams.get("topics") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  for (const t of wanted) if (await canSubscribe(actor, t)) topics.add(t);

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (s: string) => {
        if (!closed) controller.enqueue(enc.encode(s));
      };
      const event = (name: string, data: unknown) =>
        write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      // Wait until the database listener is live, so "hello" really means
      // "you will hear about every change from now on".
      const unsubscribe = await subscribe({
        topics,
        send: (hit) => event("change", { topics: hit }),
      });
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const maxAge = setTimeout(() => cleanup(), MAX_AGE_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(maxAge);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      if (req.signal.aborted) return cleanup();
      req.signal.addEventListener("abort", cleanup);

      write("retry: 3000\n\n");
      event("hello", { topics: [...topics] });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: don't buffer this response
    },
  });
}
