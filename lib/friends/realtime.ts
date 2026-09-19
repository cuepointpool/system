/* ============================================================
   Real-time fan-out: Postgres LISTEN/NOTIFY → Server-Sent Events.

   The database is the source of truth. Every mutation runs in a
   transaction that ends with pg_notify(); Postgres only delivers a
   NOTIFY on COMMIT, so nobody is told about a rolled-back change.
   A single dedicated LISTEN connection per Node process forwards
   those signals to the open SSE streams (app/api/friends/stream).

   Events are only "topic X changed" signals — never state. Clients
   refetch the authoritative view, so two screens can't disagree.

   Topics:  user:<playerId> · game:<id> · tournament:<id>
   The special topic "*" means "resync everything" — sent after the
   LISTEN connection itself had to reconnect, because changes made
   during that gap were never delivered.
   ============================================================ */

import { Client } from "pg";

export const CHANNEL = "cp_friends";

export interface Subscriber {
  topics: Set<string>;
  send: (topics: string[]) => void;
}

interface Hub {
  subs: Set<Subscriber>;
  client: Client | null;
  ready: Promise<void> | null;
  everConnected: boolean;
  retry: number;
}

declare global {
  var __cuePointFriendsHub: Hub | undefined;
}

function hub(): Hub {
  return (globalThis.__cuePointFriendsHub ??= {
    subs: new Set(),
    client: null,
    ready: null,
    everConnected: false,
    retry: 0,
  });
}

function deliver(h: Hub, topics: string[]) {
  for (const sub of [...h.subs]) {
    const hit = topics.includes("*") ? ["*"] : topics.filter((t) => sub.topics.has(t));
    if (!hit.length) continue;
    try {
      sub.send(hit);
    } catch {
      h.subs.delete(sub);
    }
  }
}

/** Resolves once LISTEN is active (or the attempt failed; a retry is scheduled). */
function connect(h: Hub): Promise<void> {
  if (h.client) return Promise.resolve();
  if (h.ready) return h.ready;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return Promise.resolve();

  const client = new Client({
    connectionString,
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const drop = () => {
    if (h.client === client) h.client = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    // retry with backoff while anyone is still listening
    if (h.subs.size > 0) {
      const wait = Math.min(15_000, 500 * 2 ** h.retry++);
      setTimeout(() => void connect(h), wait).unref?.();
    }
  };
  client.on("error", drop);
  client.on("end", () => {
    if (h.client === client) drop();
  });
  client.on("notification", (msg) => {
    if (msg.channel !== CHANNEL || !msg.payload) return;
    try {
      deliver(h, (JSON.parse(msg.payload) as { t: string[] }).t);
    } catch {
      /* malformed payload — ignore */
    }
  });

  h.ready = (async () => {
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      h.client = client;
      h.retry = 0;
      // anything that changed while we weren't listening was never delivered
      if (h.everConnected) deliver(h, ["*"]);
      h.everConnected = true;
    } catch (err) {
      console.error("[friends] LISTEN failed", err);
      drop();
    }
  })().finally(() => {
    h.ready = null;
  });
  return h.ready;
}

/**
 * Register a stream. Resolves once the LISTEN connection is live, so the
 * caller can tell the browser "you're connected" without a window in which
 * a change would be missed. Returns the unsubscribe function.
 */
export async function subscribe(sub: Subscriber): Promise<() => void> {
  const h = hub();
  h.subs.add(sub);
  await Promise.race([connect(h), new Promise<void>((r) => setTimeout(r, 3000))]);
  return () => {
    h.subs.delete(sub);
  };
}
