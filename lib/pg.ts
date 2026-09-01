/* ============================================================
   Shared Postgres connection pool.

   The whole app (bookings + player ecosystem) talks to Postgres
   through this module — raw SQL, no ORM. One lazily-created pool
   per process (safe at build time: nothing connects until the
   first query actually runs).
   ============================================================ */

import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// Return DATE columns (oid 1082) as plain 'YYYY-MM-DD' strings. The default
// parser builds a local-midnight Date, which shifts the calendar day by the
// server's UTC offset when re-serialised — bookings, contributions, expenses
// and cash days all key on the literal date, so keep it a string.
types.setTypeParser(1082, (v) => v);

declare global {
  var __cuePointPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis.__cuePointPool) return globalThis.__cuePointPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env with a Postgres " +
        "connection string, then run `npm run db:setup && npm run db:seed`.",
    );
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  pool.on("error", (err) => console.error("[pg] idle client error", err));
  globalThis.__cuePointPool = pool;
  return pool;
}

/** Run a parameterised query. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

/** Single row (or null). */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a set of statements inside a transaction. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
