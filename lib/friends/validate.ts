/* ============================================================
   Roster validation — pure, shared by the UI and the API so the
   two can never disagree. Formats supply the numbers
   (lib/friends/formats.ts); this file only turns them into the
   verdict and the wording.
   ============================================================ */

import {
  requiredGamePlayers,
  requiredTournamentPlayers,
  type FormatDef,
} from "./formats";

export type RosterState = "short" | "ok" | "over";
export type RosterAction = "remove_extra" | "change_format" | "cancel";

export interface RosterCheck {
  state: RosterState;
  required: number;
  have: number;
  /** players still needed (0 unless short) */
  missing: number;
  /** players too many (0 unless over) */
  extra: number;
  message: string;
  /** what the UI should offer next. Never auto-removes anyone. */
  actions: RosterAction[];
}

const s = (n: number) => (n === 1 ? "" : "s");

/** casual game: exactly `required` players */
export function validateGameRoster(f: FormatDef, have: number): RosterCheck {
  const required = requiredGamePlayers(f);
  if (have < required) {
    const missing = required - have;
    return {
      state: "short",
      required,
      have,
      missing,
      extra: 0,
      message: `You need ${required} players to create a ${f.code} game. Please add ${missing} more player${s(missing)}.`,
      actions: [],
    };
  }
  if (have > required) {
    const extra = have - required;
    return {
      state: "over",
      required,
      have,
      missing: 0,
      extra,
      message: `${f.code} requires exactly ${required} players. You currently have ${have} players selected.`,
      actions: ["remove_extra", "change_format", "cancel"],
    };
  }
  return {
    state: "ok",
    required,
    have,
    missing: 0,
    extra: 0,
    message: `You have enough players to create a ${f.code} game.`,
    actions: [],
  };
}

export interface TournamentRosterCheck {
  state: RosterState;
  teams: { have: number; capacity: number };
  players: { have: number; required: number };
  missingPlayers: number;
  extraPlayers: number;
  message: string;
  actions: RosterAction[];
}

/**
 * Tournament roster. Teams and players are always reported separately
 * ("Teams 6/8", "Players 12/16") — in 2v2 they differ, and a bare
 * "12/8" would be nonsense.
 */
export function validateTournamentRoster(
  f: FormatDef,
  capacityTeams: number,
  teamsHave: number,
  playersHave: number,
): TournamentRosterCheck {
  const required = requiredTournamentPlayers(f, capacityTeams);
  const base = {
    teams: { have: teamsHave, capacity: capacityTeams },
    players: { have: playersHave, required },
  };
  if (playersHave > required || teamsHave > capacityTeams) {
    const extraPlayers = Math.max(0, playersHave - required);
    return {
      ...base,
      state: "over",
      missingPlayers: 0,
      extraPlayers,
      message: `A ${capacityTeams}-${f.sideNoun} ${f.code} tournament allows exactly ${required} players. You currently have ${playersHave} selected.`,
      actions: ["remove_extra", "change_format", "cancel"],
    };
  }
  if (playersHave < required) {
    const missing = required - playersHave;
    return {
      ...base,
      state: "short",
      missingPlayers: missing,
      extraPlayers: 0,
      message: `You need ${missing} more player${s(missing)} to fill this tournament.`,
      actions: [],
    };
  }
  return {
    ...base,
    state: "ok",
    missingPlayers: 0,
    extraPlayers: 0,
    message: "The tournament is full and ready to start.",
    actions: [],
  };
}

/** null when the team size is right, otherwise the user-facing error */
export function validateTeamSize(f: FormatDef, size: number): string | null {
  if (size === f.playersPerTeam) return null;
  return f.playersPerTeam === 1
    ? "A 1v1 entry must be exactly 1 player."
    : `A ${f.code} team must contain exactly ${f.playersPerTeam} players.`;
}
