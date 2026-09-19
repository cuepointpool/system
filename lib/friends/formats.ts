/* ============================================================
   Friend-play formats — the ONE place that says how many players
   a format needs. Nothing else in the app may hard-code "2v2 = 4".

   Only 8-Ball on 9-foot tables is offered, so the game itself is
   not a variable; the format is (players per team × teams).
   ============================================================ */

export type FormatCode = "1v1" | "2v2";

export interface FormatDef {
  code: FormatCode;
  label: string;
  /** what one side is called in the UI */
  sideNoun: "player" | "team";
  playersPerTeam: number;
  teamsPerMatch: number;
}

export const FORMATS: Record<FormatCode, FormatDef> = {
  "1v1": {
    code: "1v1",
    label: "1v1 Singles",
    sideNoun: "player",
    playersPerTeam: 1,
    teamsPerMatch: 2,
  },
  "2v2": {
    code: "2v2",
    label: "2v2 Doubles",
    sideNoun: "team",
    playersPerTeam: 2,
    teamsPerMatch: 2,
  },
};

export const FORMAT_LIST: FormatDef[] = Object.values(FORMATS);

/** entrants a single-elimination tournament can be created with */
export const TOURNAMENT_SIZES = [4, 8, 16] as const;
/** fewest complete teams a tournament can start with (the rest get BYEs) */
export const MIN_TEAMS_TO_START = 3;

export function isFormat(v: unknown): v is FormatCode {
  return typeof v === "string" && v in FORMATS;
}

/** players a single casual game needs = players per team × teams per match */
export function requiredGamePlayers(f: FormatDef): number {
  return f.playersPerTeam * f.teamsPerMatch;
}

/** players a tournament of `teams` entrants needs */
export function requiredTournamentPlayers(f: FormatDef, teams: number): number {
  return f.playersPerTeam * teams;
}
