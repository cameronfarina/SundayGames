import type { Position } from "../../../config/league.js";

export type LeagueProvider = "mockd" | "espn" | "sleeper" | "yahoo";
export type DraftFormat = "auction" | "snake";
export type LeagueSeasonSetupStatus = "draft" | "published" | "locked";
export type ReadinessStatus = "pass" | "warn" | "fail";
export type ReadinessSeverity = "blocker" | "warning";

export interface League {
  id: string;
  externalLeagueId: string;
  name: string;
  provider: LeagueProvider;
}

export interface FantasyTeam {
  id: string;
  leagueSeasonId: string;
  ownerId: string;
  ownerDisplayName: string;
  managerDisplayNames?: string[];
  abbreviation?: string;
  displayName: string;
  draftOrderPosition: number;
}

export interface AuctionSettings {
  budgetDollars: number;
  minimumBidDollars: number;
}

export interface SnakeSettings {
  rounds: number;
  order: string[];
  reversal: "standard" | "third-round";
}

export interface ScoringSettings {
  passingYards: number;
  passingTouchdown: number;
  rushingYards: number;
  rushingTouchdown: number;
  receivingYards: number;
  receivingTouchdown: number;
  reception: number;
}

export type LineupSettings = Record<string, number>;
export type RosterMaximums = Record<Position, number>;

export interface RosterRules {
  rosterSize: number;
  lineup: LineupSettings;
  lineupSlotCount: number;
  rosterMaximums: RosterMaximums;
}

export interface KeeperPolicy {
  mode: "previous-cost-multiplier";
  multiplier: number;
  rounding: "ceil";
}

interface LeagueSeasonSettingsCore {
  expectedTeamCount: number;
  roster: RosterRules;
  keeperPolicy: KeeperPolicy;
}

export interface AuctionLeagueSeasonSettings extends LeagueSeasonSettingsCore {
  draftFormat: "auction";
  scoring: ScoringSettings;
  auction: AuctionSettings;
  snake?: never;
}

export interface SnakeLeagueSeasonSettings extends LeagueSeasonSettingsCore {
  draftFormat: "snake";
  scoring: ScoringSettings;
  auction?: never;
  snake: SnakeSettings;
}

export interface LegacyAuctionLeagueSeasonSettings extends LeagueSeasonSettingsCore {
  draftFormat?: never;
  scoring?: never;
  auction: AuctionSettings;
  snake?: never;
}

export type LeagueSeasonSettings =
  | AuctionLeagueSeasonSettings
  | SnakeLeagueSeasonSettings
  | LegacyAuctionLeagueSeasonSettings;
export type ExplicitLeagueSeasonSettings = AuctionLeagueSeasonSettings | SnakeLeagueSeasonSettings;

export interface LeagueSeasonDraftSchedule {
  scheduledAt?: string;
  timezone?: string;
}

export interface LeagueSeason<TSettings extends LeagueSeasonSettings = LeagueSeasonSettings> {
  id: string;
  league: League;
  leagueId: string;
  seasonYear: number;
  teams: FantasyTeam[];
  settings: TSettings;
  setupStatus: LeagueSeasonSetupStatus;
  draft?: LeagueSeasonDraftSchedule;
}

export type AnyLeagueSeason = LeagueSeason<LeagueSeasonSettings>;
export type ExplicitLeagueSeason = LeagueSeason<ExplicitLeagueSeasonSettings>;
export type AuctionLeagueSeason = LeagueSeason<AuctionLeagueSeasonSettings>;
export type SnakeLeagueSeason = LeagueSeason<SnakeLeagueSeasonSettings>;
export interface StaticLeagueConfig {
  leagueId: number | string;
  teams: number;
  auctionBudget: number;
  rosterSize: number;
  scoring: ScoringSettings;
  lineup: LineupSettings;
  rosterMaximums: RosterMaximums;
}

export interface BuildCurrentMockdLeagueSeasonOptions {
  seasonYear?: number;
  leagueName?: string;
  setupStatus?: LeagueSeasonSetupStatus;
  draft?: LeagueSeasonDraftSchedule;
}

export interface LeagueSeasonReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  severity: ReadinessSeverity;
  message: string;
}

export interface LeagueSeasonReadiness {
  status: ReadinessStatus;
  canPublish: boolean;
  canLock: boolean;
  blockers: string[];
  warnings: string[];
  checks: LeagueSeasonReadinessCheck[];
}
