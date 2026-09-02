import { query } from "./pg";
import { audit, rid } from "./ecosystem/store";

/* ------------------------------------------------------------------
   Physical floor tables — managed from the admin console, read by the
   booking flow. Raw SQL against `venue_tables` (see db/schema.sql).
   ------------------------------------------------------------------ */

export interface VenueTable {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  sortOrder: number;
  active: boolean;
  bookable: boolean;
}

interface TableRow {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  sort_order: number;
  active: boolean;
  bookable: boolean;
}

function rowTo(r: TableRow): VenueTable {
  return {
    id: r.id,
    label: r.label,
    area: r.area,
    note: r.note,
    seats: Number(r.seats),
    sortOrder: Number(r.sort_order),
    active: r.active,
    bookable: r.bookable ?? true,
  };
}

function clampSeats(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return 4;
  return Math.min(20, Math.max(1, n));
}

function slugId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "table"}-${rid().slice(0, 5)}`;
}

export async function listTables(
  opts: { includeInactive?: boolean } = {},
): Promise<VenueTable[]> {
  const rows = await query<TableRow>(
    `SELECT * FROM venue_tables
     ${opts.includeInactive ? "" : "WHERE active = TRUE"}
     ORDER BY sort_order, created_at`,
  );
  return rows.map(rowTo);
}

export async function getTableById(id: string): Promise<VenueTable | null> {
  const rows = await query<TableRow>(`SELECT * FROM venue_tables WHERE id = $1`, [
    id,
  ]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function createTable(
  input: { label: string; area?: string; note?: string; seats?: number },
  actor: string,
): Promise<VenueTable> {
  const label = input.label.trim();
  const maxRows = await query<{ m: number | null }>(
    `SELECT MAX(sort_order) AS m FROM venue_tables`,
  );
  const nextOrder = Number(maxRows[0]?.m ?? -1) + 1;
  const id = slugId(label);
  await query(
    `INSERT INTO venue_tables (id,label,area,note,seats,sort_order,active)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
    [
      id,
      label,
      (input.area ?? "Main floor").trim() || "Main floor",
      (input.note ?? "").trim(),
      clampSeats(input.seats),
      nextOrder,
    ],
  );
  await audit(actor, "table.create", "table", id, label);
  return (await getTableById(id))!;
}

export async function updateTable(
  id: string,
  patch: {
    label?: string;
    area?: string;
    note?: string;
    seats?: number;
    active?: boolean;
    bookable?: boolean;
    sortOrder?: number;
  },
  actor: string,
): Promise<VenueTable | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (patch.label !== undefined) add("label", patch.label.trim());
  if (patch.area !== undefined) add("area", patch.area.trim() || "Main floor");
  if (patch.note !== undefined) add("note", patch.note.trim());
  if (patch.seats !== undefined) add("seats", clampSeats(patch.seats));
  if (patch.active !== undefined) add("active", !!patch.active);
  if (patch.bookable !== undefined) add("bookable", !!patch.bookable);
  if (patch.sortOrder !== undefined) add("sort_order", Math.trunc(patch.sortOrder));
  if (sets.length === 0) return getTableById(id);
  vals.push(id);
  await query(
    `UPDATE venue_tables SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals,
  );
  await audit(actor, "table.update", "table", id, Object.keys(patch).join(", "));
  return getTableById(id);
}

export async function deleteTable(id: string, actor: string): Promise<void> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM bookings WHERE table_id = $1`,
    [id],
  );
  const hasBookings = Number(rows[0]?.n ?? 0) > 0;
  if (hasBookings) {
    await query(`UPDATE venue_tables SET active = FALSE WHERE id = $1`, [id]);
    await audit(actor, "table.retire", "table", id, "had bookings — deactivated");
  } else {
    await query(`DELETE FROM venue_tables WHERE id = $1`, [id]);
    await audit(actor, "table.delete", "table", id, "");
  }
}
