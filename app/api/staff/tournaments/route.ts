import { NextRequest, NextResponse } from "next/server";
import { staffActor } from "@/lib/ecosystem/identity";
import {
  CancelCodeError,
  createTournament,
  generateBracket,
  requestHostedCancelCode,
  setTournamentBestOf,
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
  // only a name is needed — dates are optional (a tournament can run over any number of days)
  if (!String(body.name ?? "").trim())
    return NextResponse.json({ error: "Give the tournament a name" }, { status: 422 });
  const t = await createTournament(
    {
      name: String(body.name),
      summary: body.summary,
      format: body.format,
      startAt: body.startAt || null,
      registrationDeadline: body.registrationDeadline || null,
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
      bestOf: body.bestOf,
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
  if (body.action === "best-of") {
    const t = await setTournamentBestOf(slug, body.bestOf, actor);
    if (!t) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    return NextResponse.json({ ok: true, tournament: t });
  }
  if (body.action === "cancel-code") {
    const code = await requestHostedCancelCode(slug);
    if (!code) return NextResponse.json({ error: "This tournament can't be cancelled." }, { status: 409 });
    return NextResponse.json({ ok: true, code });
  }
  if (body.action === "set-status" && STATUSES.includes(body.status)) {
    try {
      const t = await setTournamentStatus(slug, body.status, actor, body.code);
      return NextResponse.json({ ok: true, tournament: t });
    } catch (e) {
      if (e instanceof CancelCodeError) return NextResponse.json({ error: e.message }, { status: 422 });
      throw e;
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
