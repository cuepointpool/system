/* ============================================================
   Friends League points — a separate ledger from the official
   Cue Point ranking, loyalty and campaign XP. Friends report their
   own results, so these points are for fun and never feed anything
   that carries real value.
   ============================================================ */

export const FRIEND_POINTS = {
  gameWin: 10,
  gameLoss: 2,
  tournamentMatchWin: 15,
  champion: 50,
  runnerUp: 25,
  semiFinalist: 10,
} as const;

/** anti-farming: the same set of players can earn casual-game points at most
 *  this many times in a rolling 24h … */
export const MAX_POINTED_GAMES_PER_ROSTER_PER_DAY = 3;
/** … and tournament points at most this many times */
export const MAX_POINTED_TOURNAMENTS_PER_ROSTER_PER_DAY = 2;

export type PointReason =
  | "game_win"
  | "game_loss"
  | "match_win"
  | "champion"
  | "runner_up"
  | "semi_finalist";

export const POINT_REASON_LABEL: Record<PointReason, string> = {
  game_win: "Game win",
  game_loss: "Game played",
  match_win: "Tournament match win",
  champion: "Tournament champion",
  runner_up: "Tournament runner-up",
  semi_finalist: "Reached the semi-final",
};

/** the same group of players, whatever order they were added in */
export function rosterKey(playerIds: string[]): string {
  return [...new Set(playerIds)].sort().join(",");
}
