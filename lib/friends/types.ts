/* View models the friend-play API returns. The database is the source of
   truth; these are just its current shape as one viewer is allowed to see it. */

import type { FormatCode } from "./formats";

export type GameStatus =
  | "waiting_for_players"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TournamentStatus =
  | "registration_open"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ResultStatus = "none" | "reported" | "disputed";
export type MemberStatus = "invited" | "accepted";

export interface PlayerRef {
  id: string;
  slug: string;
  nickname: string;
  avatar: string | null;
}

export interface MemberView extends PlayerRef {
  status: MemberStatus;
}

export interface TeamView {
  id: string;
  /** "John & Mike" — derived from the members, not stored */
  name: string;
  seed: number | null;
  members: MemberView[];
  /** every seat filled by an accepted player */
  complete: boolean;
}

export interface GameViewer {
  isOrganizer: boolean;
  isPlayer: boolean;
  /** this viewer's team in the game, if any */
  teamId: string | null;
  /** has a pending invitation to this game */
  invited: boolean;
  canStart: boolean;
  canReport: boolean;
  canConfirm: boolean;
  canDispute: boolean;
  canSettle: boolean;
  canCancel: boolean;
  canManage: boolean;
  canLeave: boolean;
}

export interface GameView {
  id: string;
  name: string;
  format: FormatCode;
  playersPerTeam: number;
  requiredPlayers: number;
  /** accepted players */
  joined: number;
  status: GameStatus;
  organizer: PlayerRef;
  teamA: TeamView | null;
  teamB: TeamView | null;
  winnerTeamId: string | null;
  resultStatus: ResultStatus;
  reportedWinnerTeamId: string | null;
  reportedBy: PlayerRef | null;
  tournament: { id: string; name: string } | null;
  round: number | null;
  roundName: string | null;
  position: number | null;
  isBye: boolean;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  viewer: GameViewer;
}

export interface TournamentViewer {
  isOrganizer: boolean;
  isMember: boolean;
  invited: boolean;
  teamId: string | null;
  canManage: boolean;
  canStart: boolean;
  canCancel: boolean;
  canLeave: boolean;
}

export interface BracketRound {
  round: number;
  name: string;
  games: GameView[];
}

export interface TournamentView {
  id: string;
  name: string;
  format: FormatCode;
  playersPerTeam: number;
  capacityTeams: number;
  requiredPlayers: number;
  seeding: "random" | "ranking";
  status: TournamentStatus;
  organizer: PlayerRef;
  teams: TeamView[];
  /** teams that have every seat filled by an accepted player */
  teamsComplete: number;
  /** accepted players across all teams */
  playersJoined: number;
  rounds: BracketRound[];
  byes: number;
  champion: TeamView | null;
  runnerUp: TeamView | null;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  viewer: TournamentViewer;
}

/** row in a list (My Games / My Tournaments / Invitations) */
export interface GameListItem {
  id: string;
  name: string;
  format: FormatCode;
  status: GameStatus;
  joined: number;
  requiredPlayers: number;
  organizer: PlayerRef;
  invited: boolean;
  won: boolean | null;
  createdAt: string;
  version: number;
}

export interface TournamentListItem {
  id: string;
  name: string;
  format: FormatCode;
  status: TournamentStatus;
  capacityTeams: number;
  teams: number;
  teamsComplete: number;
  playersJoined: number;
  requiredPlayers: number;
  organizer: PlayerRef;
  invited: boolean;
  /** an unfinished match this player can act on right now */
  nextGameId: string | null;
  createdAt: string;
  version: number;
}

export interface NotificationItem {
  id: string;
  kind: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface FriendPointsSummary {
  total: number;
  rank: number | null;
  gamesPlayed: number;
  wins: number;
  tournamentsWon: number;
  recent: { points: number; reason: string; at: string }[];
}

export interface MyPlay {
  games: GameListItem[];
  tournaments: TournamentListItem[];
  points: FriendPointsSummary;
  unread: number;
}
