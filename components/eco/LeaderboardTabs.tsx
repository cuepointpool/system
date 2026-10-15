"use client";

import { useState } from "react";
import { Tabs } from "./Primitives";
import { RankingsBoard } from "./RankingsBoard";
import { RankedBoard } from "./RankedBoard";
import { GameLeaderboardBoard } from "./GameLeaderboardBoard";
import type { CampaignLeaderboardRow } from "@/lib/campaign/progress";
import type { RankedLeaderboardRow } from "@/lib/ecosystem/store";
import type { LeaderboardRow } from "@/lib/ecosystem/types";

type Board = "inhouse" | "ranked" | "game";

const NOTE: Record<Board, string> = {
  inhouse: "Every registered player · moves when registered players play each other (never against a guest)",
  ranked: "Cue Point–hosted tournaments only · points for how far you get",
  game: "Campaign level & XP from completed missions",
};

export function LeaderboardTabs({
  official,
  ranked,
  game,
}: {
  official: LeaderboardRow[];
  ranked: { rows: RankedLeaderboardRow[]; tournaments: number };
  game: CampaignLeaderboardRow[];
}) {
  const [board, setBoard] = useState<Board>("inhouse");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={[
            { value: "inhouse", label: "In-house" },
            { value: "ranked", label: "Ranked" },
            { value: "game", label: "Game World" },
          ]}
          value={board}
          onChange={(v) => setBoard(v as Board)}
        />
        <p className="text-xs text-mist">{NOTE[board]}</p>
      </div>
      {board === "inhouse" && <RankingsBoard initial={official} />}
      {board === "ranked" && <RankedBoard rows={ranked.rows} tournaments={ranked.tournaments} />}
      {board === "game" && <GameLeaderboardBoard rows={game} />}
    </div>
  );
}
