import type { Position } from "../../config/league.js";

export type LeagueProvider = "mockd" | "espn" | "sleeper" | "yahoo";
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

export interface LeagueSeasonSettings {
  expectedTeamCount: number;
  auction: AuctionSettings;
  roster: RosterRules;
  keeperPolicy: KeeperPolicy;
}

export interface LeagueSeasonDraftSchedule {
  scheduledAt?: string;
  timezone?: string;
}

export interface LeagueSeason {
  id: string;
  league: League;
  leagueId: string;
  seasonYear: number;
  teams: FantasyTeam[];
  settings: LeagueSeasonSettings;
  setupStatus: LeagueSeasonSetupStatus;
  draft?: LeagueSeasonDraftSchedule;
}

export interface StaticLeagueConfig {
  leagueId: number | string;
  teams: number;
  auctionBudget: number;
  rosterSize: number;
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

const defaultSeasonYear = 2026;
const defaultLeagueName = "Mockd";
const defaultKeeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};

const slugFor = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const sumSlots = (lineup: LineupSettings): number =>
  Object.values(lineup).reduce((total, slotCount) => total + slotCount, 0);

const cloneLineup = (lineup: LineupSettings): LineupSettings => ({ ...lineup });

const cloneRosterMaximums = (rosterMaximums: RosterMaximums): RosterMaximums => ({
  QB: rosterMaximums.QB,
  RB: rosterMaximums.RB,
  WR: rosterMaximums.WR,
  TE: rosterMaximums.TE,
  K: rosterMaximums.K,
  DST: rosterMaximums.DST,
});

export const calculateKeeperCost = (policy: KeeperPolicy, previousCost: number): number => {
  if (policy.rounding === "ceil") return Math.ceil(previousCost * policy.multiplier);

  return previousCost;
};

export const buildCurrentMockdLeagueSeason = (
  owners: readonly string[],
  config: StaticLeagueConfig,
  options: BuildCurrentMockdLeagueSeasonOptions = {},
): LeagueSeason => {
  const seasonYear = options.seasonYear ?? defaultSeasonYear;
  const leagueId = `league-${config.leagueId}`;
  const leagueSeasonId = `${leagueId}-season-${seasonYear}`;
  const teams = owners.map((owner, index): FantasyTeam => {
    const ownerSlug = slugFor(owner);

    return {
      id: `${leagueSeasonId}-team-${String(index + 1).padStart(2, "0")}-${ownerSlug}`,
      leagueSeasonId,
      ownerId: `owner-${ownerSlug}`,
      ownerDisplayName: owner,
      displayName: owner,
      draftOrderPosition: index + 1,
    };
  });
  const lineup = cloneLineup(config.lineup);

  return {
    id: leagueSeasonId,
    league: {
      id: leagueId,
      externalLeagueId: String(config.leagueId),
      name: options.leagueName ?? defaultLeagueName,
      provider: "mockd",
    },
    leagueId,
    seasonYear,
    teams,
    settings: {
      expectedTeamCount: config.teams,
      auction: {
        budgetDollars: config.auctionBudget,
        minimumBidDollars: 1,
      },
      roster: {
        rosterSize: config.rosterSize,
        lineup,
        lineupSlotCount: sumSlots(lineup),
        rosterMaximums: cloneRosterMaximums(config.rosterMaximums),
      },
      keeperPolicy: { ...defaultKeeperPolicy },
    },
    setupStatus: options.setupStatus ?? "draft",
    ...(options.draft === undefined ? {} : { draft: { ...options.draft } }),
  };
};

export const validateTeamCount = (season: LeagueSeason): LeagueSeasonReadinessCheck => {
  const actualTeamCount = season.teams.length;
  const expectedTeamCount = season.settings.expectedTeamCount;

  return {
    key: "team-count",
    label: "Team count",
    status: actualTeamCount === expectedTeamCount ? "pass" : "fail",
    severity: "blocker",
    message: actualTeamCount === expectedTeamCount
      ? `${actualTeamCount}/${expectedTeamCount} teams are configured.`
      : `Expected ${expectedTeamCount} teams, but found ${actualTeamCount}.`,
  };
};

export const validateAuctionBudget = (settings: AuctionSettings): LeagueSeasonReadinessCheck => ({
  key: "auction-budget",
  label: "Auction budget",
  status: settings.budgetDollars > 0 ? "pass" : "fail",
  severity: "blocker",
  message: settings.budgetDollars > 0
    ? `Auction budget is $${settings.budgetDollars}.`
    : "Auction budget must be greater than $0.",
});

export const validateRosterSlots = (rules: RosterRules): LeagueSeasonReadinessCheck => ({
  key: "roster-slots",
  label: "Roster slots",
  status: rules.rosterSize === rules.lineupSlotCount ? "pass" : "fail",
  severity: "blocker",
  message: rules.rosterSize === rules.lineupSlotCount
    ? `${rules.rosterSize} roster slots match the lineup settings.`
    : `Roster size is ${rules.rosterSize}, but lineup slots add up to ${rules.lineupSlotCount}.`,
});

export const validateRosterMaximums = (rules: RosterRules): LeagueSeasonReadinessCheck => {
  const missingMaximums = (["QB", "RB", "WR", "TE", "K", "DST"] as const)
    .filter(position => !Number.isFinite(rules.rosterMaximums[position]) || rules.rosterMaximums[position] <= 0);

  return {
    key: "roster-maximums",
    label: "Roster maximums",
    status: missingMaximums.length === 0 ? "pass" : "fail",
    severity: "blocker",
    message: missingMaximums.length === 0
      ? "Roster maximums are configured for every position."
      : `Missing roster maximums for ${missingMaximums.join(", ")}.`,
  };
};

export const validatePublishLockState = (
  season: LeagueSeason,
  hasBlockers: boolean,
): LeagueSeasonReadinessCheck => {
  if (hasBlockers) {
    return {
      key: "publish-lock-state",
      label: "Publish and lock state",
      status: "fail",
      severity: "warning",
      message: "Fix season setup blockers before publishing or locking.",
    };
  }

  if (season.setupStatus === "draft") {
    return {
      key: "publish-lock-state",
      label: "Publish and lock state",
      status: "warn",
      severity: "warning",
      message: "Season is ready but has not been published.",
    };
  }

  return {
    key: "publish-lock-state",
    label: "Publish and lock state",
    status: "pass",
    severity: "warning",
    message: season.setupStatus === "published"
      ? "Season is published and can be locked."
      : "Season is locked.",
  };
};

export const assessLeagueSeasonReadiness = (season: LeagueSeason): LeagueSeasonReadiness => {
  const setupChecks = [
    validateTeamCount(season),
    validateAuctionBudget(season.settings.auction),
    validateRosterSlots(season.settings.roster),
    validateRosterMaximums(season.settings.roster),
  ];
  const hasBlockers = setupChecks.some(check => check.status === "fail");
  const checks = [
    ...setupChecks,
    validatePublishLockState(season, hasBlockers),
  ];
  const blockers = checks
    .filter(check => check.severity === "blocker" && check.status === "fail")
    .map(check => check.message);
  const warnings = checks
    .filter(check => check.severity === "warning" && check.status === "warn")
    .map(check => check.message);

  return {
    status: blockers.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    canPublish: blockers.length === 0 && season.setupStatus === "draft",
    canLock: blockers.length === 0 && season.setupStatus === "published",
    blockers,
    warnings,
    checks,
  };
};
