/* ============================================================
   Cue Point — player ecosystem data model
   Players · Matches · Rankings · Tournaments · Membership ·
   Loyalty · Promotions · Achievements
   ============================================================ */

export type SkillLevel = "Rookie" | "Amateur" | "Intermediate" | "Advanced" | "Pro";
export type MatchType = "casual" | "ranked" | "tournament";
export type MatchResult = "W" | "L";
export type MembershipTier = "basic" | "pro" | "elite";
export type MembershipStatus = "active" | "expired" | "none";
export type LoyaltySource =
  | "booking"
  | "match"
  | "ranked_win"
  | "tournament"
  | "referral"
  | "promotion"
  | "membership"
  | "manual"
  | "redemption";
export type TournamentFormat =
  | "single_elim"
  | "double_elim"
  | "round_robin"
  | "league";
export type TournamentStatus =
  | "registration_open"
  | "registration_closed"
  | "upcoming"
  | "live"
  | "completed"
  | "cancelled";
export type RankingScope = "weekly" | "monthly" | "all_time" | "tournament";

export type UserRole = "player" | "staff" | "admin";

export interface PlayerProfile {
  id: string;
  slug: string; // used in URLs
  fullName: string;
  nickname: string; // player / handle name
  email: string | null;
  role: UserRole;
  avatar: string | null; // /media path or null -> initials
  skillLevel: SkillLevel;
  bio: string;
  homeTable: string | null;
  joinedAt: string; // ISO
  membershipTier: MembershipTier;
  membershipStatus: MembershipStatus;
  membershipExpiry: string | null;
  loyaltyPoints: number; // current balance
  loyaltyLifetime: number; // lifetime earned
  achievementIds: string[];
}

/** Cached, service-maintained aggregates — always derivable from the match log. */
export interface PlayerStats {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number; // 0-100, 1dp
  rankingPoints: number;
  rank: number; // 1-based, 0 = unranked
  previousRank: number; // for movement indicator
  rankMovement: number; // rank - previousRank inverted -> positive = climbed
  recentForm: MatchResult[]; // most-recent-first, up to 5
  bestBreak: number; // highest break / best performance metric
  streak: number; // + = win streak, - = loss streak
  rankedMatches: number;
  tournamentsPlayed: number;
  titlesWon: number;
}

export interface Match {
  id: string;
  ref: string; // CP-M-XXXX
  type: MatchType;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
  tableName: string;
  tournamentId: string | null;
  tournamentRound: string | null; // "Quarter Final" etc.
  playedAt: string; // ISO
  // ranking snapshot (from A's perspective; B mirrored)
  aPointsBefore: number;
  aPointsAfter: number;
  bPointsBefore: number;
  bPointsAfter: number;
  recordedBy: string;
}

export interface RankingHistoryEntry {
  id: string;
  playerId: string;
  points: number;
  rank: number;
  matchId: string | null;
  reason: string;
  at: string; // ISO
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // key for AchievementIcon
  tier: "bronze" | "silver" | "gold" | "platinum";
}

export interface MembershipPlan {
  id: MembershipTier;
  name: string;
  price: number; // LKR / period
  billingPeriod: "monthly" | "quarterly" | "yearly";
  tagline: string;
  benefits: string[];
  discountPct: number;
  bookingPriority: number; // higher = better
  loyaltyMultiplier: number;
  badge: string; // label
  featured: boolean;
  status: "active" | "hidden";
}

export interface UpcomingMatch {
  id: string;
  playerAId: string;
  playerBId: string;
  tableName: string;
  scheduledAt: string; // ISO
  tournamentId: string | null;
  round: string | null;
  type: MatchType;
}

export interface TournamentPlayerSlot {
  registrationId: string;
  playerId: string | null; // null = TBD / bye
  seed: number | null;
}

export interface BracketMatch {
  id: string;
  round: number; // 1 = first round
  roundName: string; // "Quarter Final"
  position: number; // index within round
  aId: string | null;
  bId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  scheduledAt: string | null;
  tableName: string | null;
  nextMatchId: string | null; // where the winner advances
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  cover: string; // /media path or gradient key
  summary: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startAt: string; // ISO
  registrationDeadline: string; // ISO
  entryFee: number;
  prizePool: number;
  prizeBreakdown: { place: string; amount: number }[];
  maxPlayers: number;
  venue: string;
  rules: string[];
  registrations: TournamentPlayerSlot[];
  bracket: BracketMatch[];
  championId: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  playerId: string;
  points: number; // + earn / - redeem
  reason: string;
  source: LoyaltySource;
  referenceId: string | null;
  at: string; // ISO
  expiresAt: string | null;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number; // loyalty points
  category: "play" | "discount" | "food" | "merch" | "tournament";
  icon: string;
  status: "active" | "hidden";
}

export interface Promotion {
  id: string;
  slug: string;
  title: string;
  description: string;
  type:
    | "happy_hour"
    | "student"
    | "group"
    | "weekend"
    | "tournament"
    | "membership"
    | "loyalty"
    | "limited";
  image: string; // gradient key or /media path
  startAt: string; // ISO
  endAt: string; // ISO
  eligibility: string;
  discount: string; // human string e.g. "30% off table time"
  promoCode: string | null;
  membershipRestriction: MembershipTier[] | null;
  usageNote: string | null;
  status: "active" | "hidden";
}

/* ---- Directory (future SL pool platform, Cue Point = venue #1) ---- */
export interface Venue {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  cover: string | null;
  district: string;
  city: string;
  address: string;
  tableCount: number;
  tableTypes: string[];
  hourlyRateFrom: number;
  facilities: string[];
  phone: string | null;
  socials: Record<string, string>;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number;
  onlineBooking: boolean;
  hostsTournaments: boolean;
  isPrimary: boolean; // Cue Point
}

/* ---- Staff audit ---- */
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  at: string;
}

/* ---- Composite view returned by the profile API ---- */
export interface PlayerProfileView {
  profile: PlayerProfile;
  stats: PlayerStats;
  achievements: Achievement[];
  recentMatches: MatchView[];
  tournamentHistory: {
    tournamentId: string;
    name: string;
    slug: string;
    status: TournamentStatus;
    placement: string | null;
  }[];
  upcomingMatches: UpcomingMatchView[];
  membershipPlan: MembershipPlan | null;
}

export interface MatchView extends Match {
  playerA: PlayerLite;
  playerB: PlayerLite;
  tournamentName: string | null;
}

export interface UpcomingMatchView extends UpcomingMatch {
  playerA: PlayerLite;
  playerB: PlayerLite;
  tournamentName: string | null;
}

export interface PlayerLite {
  id: string;
  slug: string;
  nickname: string;
  fullName: string;
  avatar: string | null;
  rank: number;
  skillLevel: SkillLevel;
  membershipTier: MembershipTier;
}

export interface LeaderboardRow extends PlayerLite {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  rankingPoints: number;
  recentForm: MatchResult[];
  rankMovement: number;
  streak: number;
}
