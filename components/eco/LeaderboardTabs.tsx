"use client";

import { useState } from "react";
import { Tabs } from "./Primitives";
import { RankingsBoard } from "./RankingsBoard";
import { GameLeaderboardBoard } from "./GameLeaderboardBoard";
import type { CampaignLeaderboardRow } from "@/lib/campaign/progress";
import type { LeaderboardRow } from "@/lib/ecosystem/types";

type Board = "official" | "game";

export function LeaderboardTabs({
  official,
  game,
}: {
  official: LeaderboardRow[];
  game: CampaignLeaderboardRow[];
}) {
  const [board, setBoard] = useState<Board>("official");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={[
            { value: "official", label: "Official" },
            { value: "game", label: "Game World" },
          ]}
          value={board}
          onChange={(v) => setBoard(v as Board)}
        />
        <p className="text-xs text-mist">
          {board === "official"
            ? "Skill ranking from ranked & tournament matches"
            : "Campaign level & XP from completed missions"}
        </p>
      </div>
      {board === "official" ? (
        <RankingsBoard initial={official} />
      ) : (
        <GameLeaderboardBoard rows={game} />
      )}
    </div>
  );
}
