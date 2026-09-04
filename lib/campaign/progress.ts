/* ============================================================
   Campaign progress — per-player state for the Season 1 campaign.

   Content (missions, chapters, objectives, rewards) comes from
   ./content.ts. This module owns everything that is per-player and
   therefore lives in Postgres: which objectives are ticked, which
   missions are complete, stars, XP and coins.

   Progression rule: missions unlock in order. Mission N is playable
   once N-1 is complete; a chapter unlocks when the previous chapter's
   boss (its 10th mission) is done.
   ============================================================ */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { query, queryOne, transaction } from "../pg";
import { rid } from "../ecosystem/store";
import {
  CHAPTERS,
  MISSIONS,
  STARS_PER_MISSION,
  TOTAL_MISSIONS,
  TOTAL_STARS,
  getMission,
  type CampaignChapter,
  type CampaignMission,
} from "./content";

/* ---- artwork resolution ---------------------------------------------
   Missions, chapters and rivals each name the artwork they *want* (per the
   asset brief). Most of those files don't exist yet, so we resolve against
   what is actually on disk here, server-side, and hand the client a URL that
   is known to load. Without this the browser would request every missing
   file, 404, and only then swap in the fallback — a flash on every card.

   Drop a real file in public/assets/campaign and it is picked up on the next
   request in dev, or the next deploy in production. */

const ASSET_DIR = join(process.cwd(), "public", "assets", "campaign");

let assetCache: { names: Set<string>; at: number } | null = null;

function assetNames(): Set<string> {
  const ttl = process.env.NODE_ENV === "production" ? Infinity : 2_000;
  if (assetCache && Date.now() - assetCache.at < ttl) return assetCache.names;
  let names = new Set<string>();
  try {
    if (existsSync(ASSET_DIR)) names = new Set(readdirSync(ASSET_DIR));
  } catch {
    // an unreadable asset dir must never take the campaign down
  }
  assetCache = { names, at: Date.now() };
  return names;
}

/** The intended path if its file exists, otherwise the shipped fallback. */
function resolveArt(intended: string, fallback: string): string {
  const file = intended.split("/").pop();
  return file && assetNames().has(file) ? intended : fallback;
}

export type MissionState = "completed" | "current" | "locked";

export interface MissionProgress {
  missionId: string;
  objectivesDone: number;
  stars: number;
  completedAt: string | null;
}

export interface MissionView extends CampaignMission {
  state: MissionState;
  objectivesDone: number;
  stars: number;
  completedAt: string | null;
}

export interface ChapterView extends CampaignChapter {
  locked: boolean;
  missionsCompleted: number;
  missionsTotal: number;
  starsEarned: number;
  starsTotal: number;
  bossCompleted: boolean;
  percent: number;
}

export interface CampaignSummary {
  xp: number;
  coins: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  missionsCompleted: number;
  missionsTotal: number;
  starsEarned: number;
  starsTotal: number;
  percent: number;
  currentMissionId: string | null;
  currentChapter: number;
}

export interface CampaignState {
  summary: CampaignSummary;
  chapters: ChapterView[];
  missions: MissionView[];
}

/* ---- levelling -----------------------------------------------------
   Levels are a soft prestige track over total campaign XP. The curve is
   deliberately shallow early (level 2 at 150 XP) and widens as chapters
   pay more, so a player is roughly level 40-45 at 100% completion. */

const LEVEL_BASE = 150;
const LEVEL_GROWTH = 1.12;

const MAX_LEVEL = 120;

/** Cumulative XP threshold to reach each level. Index 0 is unused, [1] = 0. */
const LEVEL_THRESHOLDS: number[] = (() => {
  const out = [0, 0];
  for (let l = 1; l < MAX_LEVEL; l++) {
    const step = Math.round((LEVEL_BASE * Math.pow(LEVEL_GROWTH, l - 1)) / 10) * 10;
    out.push(out[l] + step);
  }
  return out;
})();

/** Total XP required to have reached `level` (level 1 = 0 XP). */
export function xpAtLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(Math.max(level, 1), MAX_LEVEL)];
}

export function levelForXp(xp: number): {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
} {
  let level = 1;
  while (level < MAX_LEVEL - 1 && LEVEL_THRESHOLDS[level + 1] <= xp) level++;
  const floor = xpAtLevel(level);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForLevel: xpAtLevel(level + 1) - floor,
  };
}

/** Stars for a mission: 3 when every objective is ticked, scaled down below. */
export function starsFor(mission: CampaignMission, objectivesDone: number): number {
  const total = mission.objectives.length;
  if (total === 0) return 0;
  return Math.max(
    0,
    Math.min(STARS_PER_MISSION, Math.floor((objectivesDone / total) * STARS_PER_MISSION)),
  );
}

/* ---- reads ---------------------------------------------------------- */

async function progressRows(playerId: string): Promise<Map<string, MissionProgress>> {
  const rows = await query<{
    mission_id: string;
    objectives_done: number;
    stars: number;
    completed_at: Date | string | null;
  }>(
    `SELECT mission_id, objectives_done, stars, completed_at
     FROM player_missions WHERE player_id = $1`,
    [playerId],
  );
  return new Map(
    rows.map((r) => [
      r.mission_id,
      {
        missionId: r.mission_id,
        objectivesDone: Number(r.objectives_done),
        stars: Number(r.stars),
        completedAt:
          r.completed_at instanceof Date
            ? r.completed_at.toISOString()
            : r.completed_at
              ? String(r.completed_at)
              : null,
      },
    ]),
  );
}

export async function getCampaignState(playerId: string): Promise<CampaignState> {
  const [progress, wallet] = await Promise.all([
    progressRows(playerId),
    queryOne<{ campaign_xp: number; campaign_coins: number }>(
      `SELECT campaign_xp, campaign_coins FROM player_profiles WHERE id = $1`,
      [playerId],
    ),
  ]);

  // the campaign is linear: the first mission without a completion is current
  const firstIncomplete = MISSIONS.find((m) => !progress.get(m.id)?.completedAt);
  const currentNumber = firstIncomplete?.number ?? TOTAL_MISSIONS + 1;

  const missions: MissionView[] = MISSIONS.map((m) => {
    const p = progress.get(m.id);
    const state: MissionState = p?.completedAt
      ? "completed"
      : m.number === currentNumber
        ? "current"
        : "locked";
    return {
      ...m,
      image: resolveArt(m.image, m.artwork),
      rival: m.rival
        ? { ...m.rival, image: resolveArt(m.rival.image, m.artwork) }
        : null,
      state,
      objectivesDone: p?.objectivesDone ?? 0,
      stars: p?.stars ?? 0,
      completedAt: p?.completedAt ?? null,
    };
  });

  const chapters: ChapterView[] = CHAPTERS.map((c) => {
    const inChapter = missions.filter((m) => m.chapter === c.number);
    const done = inChapter.filter((m) => m.state === "completed").length;
    const stars = inChapter.reduce((s, m) => s + m.stars, 0);
    const boss = inChapter.find((m) => m.isBoss);
    const prevBoss = missions.find((m) => m.chapter === c.number - 1 && m.isBoss);
    return {
      ...c,
      image: resolveArt(c.image, c.artwork),
      locked: c.number > 1 && prevBoss?.state !== "completed",
      missionsCompleted: done,
      missionsTotal: inChapter.length,
      starsEarned: stars,
      starsTotal: inChapter.length * STARS_PER_MISSION,
      bossCompleted: boss?.state === "completed",
      percent: Math.round((done / inChapter.length) * 100),
    };
  });

  const xp = Number(wallet?.campaign_xp ?? 0);
  const missionsCompleted = missions.filter((m) => m.state === "completed").length;
  const starsEarned = missions.reduce((s, m) => s + m.stars, 0);
  const { level, xpIntoLevel, xpForLevel } = levelForXp(xp);

  return {
    summary: {
      xp,
      coins: Number(wallet?.campaign_coins ?? 0),
      level,
      xpIntoLevel,
      xpForLevel,
      missionsCompleted,
      missionsTotal: TOTAL_MISSIONS,
      starsEarned,
      starsTotal: TOTAL_STARS,
      percent: Math.round((missionsCompleted / TOTAL_MISSIONS) * 100),
      currentMissionId: firstIncomplete?.id ?? null,
      currentChapter: firstIncomplete?.chapter ?? CHAPTERS.length,
    },
    chapters,
    missions,
  };
}

/* ---- writes ---------------------------------------------------------- */

type Result =
  | { ok: true; mission: MissionView; completed: boolean; xpGained: number; coinsGained: number; level: number }
  | { ok: false; error: string };

/**
 * Tick or untick one objective on a mission. Completing the last objective
 * completes the mission and pays out XP + coins in the same transaction.
 * Rewards are paid once — re-ticking a completed mission never pays twice.
 */
export async function setObjectivesDone(
  playerId: string,
  missionId: string,
  objectivesDone: number,
  actor: string,
): Promise<Result> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: "Unknown mission." };

  const state = await getCampaignState(playerId);
  const view = state.missions.find((m) => m.id === missionId)!;
  if (view.state === "locked") return { ok: false, error: "Finish the previous mission first." };

  const total = mission.objectives.length;
  const next = Math.max(0, Math.min(total, Math.round(objectivesDone)));
  const alreadyComplete = !!view.completedAt;
  const nowComplete = next >= total;
  const stars = starsFor(mission, next);

  // rewards are only paid on the transition into completion
  const payout = !alreadyComplete && nowComplete;
  const xpGained = payout ? mission.xp : 0;
  const coinsGained = payout ? mission.coins : 0;

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO player_missions (player_id, mission_id, objectives_done, stars, completed_at)
       VALUES ($1,$2,$3,$4, CASE WHEN $5 THEN now() ELSE NULL END)
       ON CONFLICT (player_id, mission_id) DO UPDATE
         SET objectives_done = EXCLUDED.objectives_done,
             stars           = EXCLUDED.stars,
             -- keep the original completion timestamp once it is set
             completed_at    = COALESCE(player_missions.completed_at, EXCLUDED.completed_at)`,
      [playerId, missionId, next, stars, nowComplete],
    );
    if (payout) {
      await client.query(
        `UPDATE player_profiles
         SET campaign_xp = campaign_xp + $2, campaign_coins = campaign_coins + $3
         WHERE id = $1`,
        [playerId, xpGained, coinsGained],
      );
      await client.query(
        `INSERT INTO audit_log (id, actor, action, entity, entity_id, detail)
         VALUES ($1,$2,'campaign.mission.complete','mission',$3,$4)`,
        [
          "au_" + rid(),
          actor,
          missionId,
          `${mission.title} · +${xpGained} XP · +${coinsGained} coins`,
        ],
      );
    }
  });

  const fresh = await getCampaignState(playerId);
  return {
    ok: true,
    mission: fresh.missions.find((m) => m.id === missionId)!,
    completed: nowComplete,
    xpGained,
    coinsGained,
    level: fresh.summary.level,
  };
}

/** Create the progress row when a player starts tracking a mission. */
export async function startMission(
  playerId: string,
  missionId: string,
): Promise<Result> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: "Unknown mission." };
  const state = await getCampaignState(playerId);
  const view = state.missions.find((m) => m.id === missionId)!;
  if (view.state === "locked") return { ok: false, error: "Finish the previous mission first." };

  await query(
    `INSERT INTO player_missions (player_id, mission_id) VALUES ($1,$2)
     ON CONFLICT (player_id, mission_id) DO NOTHING`,
    [playerId, missionId],
  );

  const fresh = await getCampaignState(playerId);
  return {
    ok: true,
    mission: fresh.missions.find((m) => m.id === missionId)!,
    completed: false,
    xpGained: 0,
    coinsGained: 0,
    level: fresh.summary.level,
  };
}

/* ---- leaderboard ------------------------------------------------------ */

export interface CampaignLeaderboardRow {
  id: string;
  slug: string;
  nickname: string;
  fullName: string;
  avatar: string | null;
  rank: number;
  xp: number;
  level: number;
  stars: number;
  missionsCompleted: number;
}

export async function getCampaignLeaderboard(limit = 50): Promise<CampaignLeaderboardRow[]> {
  const rows = await query<{
    id: string;
    slug: string;
    nickname: string;
    full_name: string;
    avatar: string | null;
    campaign_xp: number;
    stars: number;
    missions_completed: number;
  }>(
    `SELECT p.id, p.slug, p.nickname, p.full_name, p.avatar, p.campaign_xp,
            COALESCE(SUM(pm.stars), 0)                             AS stars,
            COUNT(pm.mission_id) FILTER (WHERE pm.completed_at IS NOT NULL) AS missions_completed
     FROM player_profiles p
     LEFT JOIN player_missions pm ON pm.player_id = p.id
     WHERE p.role = 'player'
     GROUP BY p.id
     ORDER BY p.campaign_xp DESC, missions_completed DESC, p.nickname
     LIMIT $1`,
    [limit],
  );
  return rows.map((r, i) => ({
    id: r.id,
    slug: r.slug,
    nickname: r.nickname,
    fullName: r.full_name,
    avatar: r.avatar,
    rank: i + 1,
    xp: Number(r.campaign_xp),
    level: levelForXp(Number(r.campaign_xp)).level,
    stars: Number(r.stars),
    missionsCompleted: Number(r.missions_completed),
  }));
}
