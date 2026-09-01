import { NextRequest, NextResponse } from "next/server";
import { computeStats, getPlayers, toPlayerLite } from "@/lib/ecosystem/store";
import type { LeaderboardRow, SkillLevel } from "@/lib/ecosystem/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const skill = sp.get("skill") as SkillLevel | null;
  const sort = sp.get("sort") ?? "ranking"; // ranking | active | winrate | recent
  const q = (sp.get("q") ?? "").toLowerCase().trim();

  const [{ stats }, players] = await Promise.all([computeStats(), getPlayers()]);
  let rows: LeaderboardRow[] = players.map((p) => {
    const s = stats.get(p.id)!;
    return {
      ...toPlayerLite(p, s.rank),
      matchesPlayed: s.matchesPlayed,
      wins: s.wins,
      losses: s.losses,
      winPct: s.winPct,
      rankingPoints: s.rankingPoints,
      recentForm: s.recentForm,
      rankMovement: s.rankMovement,
      streak: s.streak,
    };
  });

  if (skill) rows = rows.filter((r) => r.skillLevel === skill);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.nickname.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => {
    if (sort === "active") return b.matchesPlayed - a.matchesPlayed;
    if (sort === "winrate") return b.winPct - a.winPct;
    if (sort === "recent") return b.rankMovement - a.rankMovement;
    return a.rank - b.rank || b.rankingPoints - a.rankingPoints;
  });

  return NextResponse.json({ count: rows.length, players: rows });
}
