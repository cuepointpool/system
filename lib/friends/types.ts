/* View models the friend-play API returns. The database is the source of
   truth; these are just its current shape as one viewer is allowed to see it. */

import type { FormatCode } from "./formats";
import type { Stage, StandingRow, TournamentKind, TournamentSettings } from "./structure";

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
  /** a name-only player with no account (tournaments only); `id` is the guest row's id */
  guest?: boolean;
}

export interface TeamView {
  id: string;
  /** "John & Mike" — derived from the members, not stored */
  name: string;
  seed: number | null;
  members: MemberView[];
  /** every seat filled by an accepted player */
  complete: boolean;
  /** at least one seat is a guest — its matches earn no Friends League points */
  hasGuest: boolean;
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
  /** organizer: set the winner directly — final, no confirmation needed */
  canSettle: boolean;
  /** organizer: change or undo a finished result */
  canChange: boolean;
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
  /** which part of the tournament: knockout, upper/lower bracket, league, group, playoff… */
  stage: Stage | null;
  /** 1-based group number (group stage and its tie-breakers) */
  group: number | null;
  /** weekly leagues: play by this date (YYYY-MM-DD) */
  dueDate: string | null;
  /** match length: 1 (single frame), 3, 5, 7 or 9 */
  bestOf: number;
  /** frames won by side A / side B once finished */
  scoreA: number | null;
  scoreB: number | null;
  /** the score a player reported, awaiting confirmation */
  reportedScoreA: number | null;
  reportedScoreB: number | null;
  /** the table a running match is on, if someone said */
  tableName: string | null;
  /** final rounds of a Groups tournament: who will fill an empty slot ("Group A winner") */
  sourceA: string | null;
  sourceB: string | null;
  isBye: boolean;
  /** a guest is playing on either side, so no Friends League points are awarded */
  guestMatch: boolean;
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
  /** organizer: may change the format while registration is open */
  canEditFormat: boolean;
}

export interface BracketRound {
  round: number;
  name: string;
  games: GameView[];
}

export interface StandingView extends StandingRow {
  team: TeamView;
  /** goes through to the next stage / wins (once the table is final) */
  through: boolean;
}

/** one tab of the tournament page */
export type TournamentSection =
  | { id: string; title: string; kind: "bracket"; rounds: BracketRound[] }
  | {
      id: string;
      title: string;
      kind: "table";
      group: number | null;
      rows: StandingView[];
      /** lines drawn under these places ("top 2 go through") */
      cuts: number[];
      cutNote: string;
      rounds: BracketRound[];
    }
  | { id: string; title: string; kind: "list"; games: GameView[] };

/** a tie the tournament can't get past yet */
export interface PendingTie {
  group: number | null;
  title: string;
  teams: TeamView[];
  /** play-off matches still to play between these level players */
  matchesLeft: number;
  /** 1 = first play-off; 2+ = they came out level again and play another round */
  playoffRound: number;
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
  /** accepted players across all teams (guests included) */
  playersJoined: number;
  /** how many of those are guests */
  guests: number;
  kind: TournamentKind;
  settings: TournamentSettings;
  /** main = first stage; tiebreak = settling ties; playoffs = knockout after the table */
  phase: "main" | "tiebreak" | "playoffs";
  sections: TournamentSection[];
  pendingTies: PendingTie[];
  /** the viewer's match that needs them now (play, confirm), if any */
  myNextGame: GameView | null;
  byes: number;
  champion: TeamView | null;
  runnerUp: TeamView | null;
  third: TeamView | null;
  /** groups with no knockout: each group's winner */
  groupWinners: { group: number; title: string; team: TeamView }[];
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
  kind: TournamentKind;
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
