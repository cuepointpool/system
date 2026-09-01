import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  createTournament,
  generateBracket,
  setTournamentStatus,
} from "@/lib/ecosystem/store";
import type { TournamentStatus } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

const STATUSES: TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "upcoming",
  "live",
  "completed",
  "cancelled",
];

export async function POST(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!String(body.name ?? "").trim() || !body.startAt || !body.registrationDeadline)
    return NextResponse.json(
      { error: "Name, start date and registration deadline are required" },
      { status: 422 },
    );
  const t = await createTournament(
    {
      name: String(body.name),
      summary: body.summary,
      format: body.format,
      startAt: body.startAt,
      registrationDeadline: body.registrationDeadline,
      entryFee: Number(body.entryFee) || 0,
      prizePool: Number(body.prizePool) || 0,
      maxPlayers: Number(body.maxPlayers) || 8,
      venue: body.venue,
      rules: Array.isArray(body.rules)
        ? body.rules
        : String(body.rules ?? "")
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean),
      cover: body.cover,
    },
    actor,
  );
  return NextResponse.json({ ok: true, tournament: t }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await staffActor(req);
  if (!actor) return NextResponse.json({ error: "Staff only" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 422 });

  if (body.action === "generate-bracket") {
    const res = await generateBracket(slug, actor);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
    return NextResponse.json({ ok: true, tournament: res.tournament });
  }
  if (body.action === "set-status" && STATUSES.includes(body.status)) {
    const t = await setTournamentStatus(slug, body.status, actor);
    return NextResponse.json({ ok: true, tournament: t });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
