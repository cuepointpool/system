import { NextRequest, NextResponse } from "next/server";
import { adminActor } from "@/lib/ecosystem/identity";
import { audit } from "@/lib/ecosystem/store";
import { ClubError, createClub, listClubs, updateClubLogin } from "@/lib/clubs/store";

export const dynamic = "force-dynamic";

const fail = (err: unknown) => {
  if (err instanceof ClubError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[admin/clubs]", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
};

/** Admin-only: partner clubs and their admin logins. */
export async function GET(req: NextRequest) {
  if (!(await adminActor(req))) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  return NextResponse.json({ clubs: await listClubs() });
}

export async function POST(req: NextRequest) {
  const actor = await adminActor(req);
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const club = await createClub({ name: b.name, username: b.username, password: b.password });
    await audit(actor, "club.create", "club", club.id, `${club.name} (login ${club.username})`);
    return NextResponse.json({ club, clubs: await listClubs() });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await adminActor(req);
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing club id" }, { status: 422 });
  try {
    await updateClubLogin(id, { name: b.name, username: b.username, password: b.password, active: b.active });
    const changed = ["name", "username", "password", "active"].filter((k) => b[k] !== undefined && b[k] !== "");
    await audit(actor, "club.update", "club", id, changed.join(", "));
    return NextResponse.json({ clubs: await listClubs() });
  } catch (err) {
    return fail(err);
  }
}
