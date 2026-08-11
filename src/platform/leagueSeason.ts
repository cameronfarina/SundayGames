import type { Position } from "../../config/league.js";

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
export type ExplicitLeagueSeasonSettings =
  | AuctionLeagueSeasonSettings
  | SnakeLeagueSeasonSettings;

export interface LeagueSeasonDraftSchedule {
  scheduledAt?: string;
  timezone?: string;
}

export interface LeagueSeason<
  TSettings extends LeagueSeasonSettings = any,
> {
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

const defaultSeasonYear = 2026;
const defaultLeagueName = "Mockd";
const defaultKeeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};

export const defaultScoringSettings: ScoringSettings = {
  passingYards: 0.04,
  passingTouchdown: 4,
  rushingYards: 0.1,
  rushingTouchdown: 6,
  receivingYards: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
};

export const normalizeLeagueSeasonSettings = (
  settings: LeagueSeasonSettings,
): ExplicitLeagueSeasonSettings => {
  const scoring = {
    ...defaultScoringSettings,
    ...settings.scoring,
  };

  if (settings.draftFormat === "snake") {
    return {
      expectedTeamCount: settings.expectedTeamCount,
      draftFormat: "snake",
      scoring,
      snake: {
        ...settings.snake,
        order: [...settings.snake.order],
      },
      roster: settings.roster,
      keeperPolicy: settings.keeperPolicy,
    };
  }

  return {
    expectedTeamCount: settings.expectedTeamCount,
    draftFormat: "auction",
    scoring,
    auction: { ...settings.auction },
    roster: settings.roster,
    keeperPolicy: settings.keeperPolicy,
  };
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

const cloneScoring = (scoring: ScoringSettings): ScoringSettings => ({ ...scoring });

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
): LeagueSeason<AuctionLeagueSeasonSettings> => {
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
      draftFormat: "auction",
      scoring: cloneScoring(config.scoring),
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

export const validateTeamCount = (season: AnyLeagueSeason): LeagueSeasonReadinessCheck => {
  const actualTeamCount = season.teams.length;
  const expectedTeamCount = season.settings.expectedTeamCount;
  const hasSupportedTeamCount = Number.isInteger(expectedTeamCount)
    && expectedTeamCount >= 4
    && expectedTeamCount <= 20
    && actualTeamCount >= 4
    && actualTeamCount <= 20;
  const hasValidTeamIdentities = season.teams.every(team =>
    team.id.trim().length > 0 && team.displayName.trim().length > 0
  ) && new Set(season.teams.map(team => team.id)).size === actualTeamCount;
  const hasExpectedTeamCount = actualTeamCount === expectedTeamCount;
  const isValid = hasSupportedTeamCount && hasValidTeamIdentities && hasExpectedTeamCount;

  let message = `${actualTeamCount}/${expectedTeamCount} teams are configured.`;
  if (!hasSupportedTeamCount) {
    message = "Leagues require between 4 and 20 teams.";
  } else if (!hasExpectedTeamCount) {
    message = `Expected ${expectedTeamCount} teams, but found ${actualTeamCount}.`;
  } else if (!hasValidTeamIdentities) {
    message = "Every team needs a unique non-blank ID and a non-blank name.";
  }

  return {
    key: "team-count",
    label: "Team count",
    status: isValid ? "pass" : "fail",
    severity: "blocker",
    message,
  };
};

export const validateAuctionBudget = (
  settings: AuctionSettings,
  rosterSize?: number,
): LeagueSeasonReadinessCheck => {
  const hasValidBudget = Number.isFinite(settings.budgetDollars) && settings.budgetDollars > 0;
  const hasValidMinimumBid = Number.isFinite(settings.minimumBidDollars) &&
    settings.minimumBidDollars > 0 &&
    settings.minimumBidDollars <= settings.budgetDollars;
  const hasWholeDollarCurrency = Number.isInteger(settings.budgetDollars)
    && Number.isInteger(settings.minimumBidDollars);
  const hasMinimumBidReserve = rosterSize === undefined
    || !Number.isInteger(rosterSize)
    || rosterSize <= 0
    || settings.budgetDollars >= rosterSize * settings.minimumBidDollars;
  let message = `Auction budget is $${settings.budgetDollars}.`;

  if (!hasValidBudget) {
    message = "Auction budget must be greater than $0.";
  } else if (!hasValidMinimumBid) {
    message = "Auction minimum bid must be greater than $0 and no more than the budget.";
  } else if (!hasWholeDollarCurrency) {
    message = "Auction budget and minimum bid must be positive whole-dollar amounts.";
  } else if (!hasMinimumBidReserve && rosterSize !== undefined) {
    message = `Auction budget must reserve the $${settings.minimumBidDollars} minimum bid for all ${rosterSize} roster slots.`;
  }

  return {
    key: "auction-budget",
    label: "Auction budget",
    status: hasValidBudget && hasValidMinimumBid && hasWholeDollarCurrency && hasMinimumBidReserve
      ? "pass"
      : "fail",
    severity: "blocker",
    message,
  };
};

export const validateSnakeDraft = (
  settings: SnakeSettings,
  teams: readonly FantasyTeam[],
  rosterSize?: number,
): LeagueSeasonReadinessCheck => {
  const orderedTeamIds = new Set(settings.order);
  const hasValidRounds = Number.isInteger(settings.rounds) && settings.rounds > 0;
  const hasEveryTeamExactlyOnce = settings.order.length === teams.length &&
    orderedTeamIds.size === teams.length &&
    teams.every(team => orderedTeamIds.has(team.id));
  const fitsRosterCapacity = rosterSize === undefined || settings.rounds <= rosterSize;
  const isValid = hasValidRounds && hasEveryTeamExactlyOnce && fitsRosterCapacity;

  let message = `${settings.rounds} snake draft rounds and team order are configured.`;
  if (!hasValidRounds || !hasEveryTeamExactlyOnce) {
    message = "Snake drafts must have at least one round and include every team exactly once in draft order.";
  } else if (!fitsRosterCapacity && rosterSize !== undefined) {
    message = `Snake draft rounds cannot exceed the ${rosterSize}-player roster capacity.`;
  }

  return {
    key: "snake-draft",
    label: "Snake draft",
    status: isValid ? "pass" : "fail",
    severity: "blocker",
    message,
  };
};

export const validateScoringSettings = (settings: ScoringSettings): LeagueSeasonReadinessCheck => {
  const yardagePoints = [settings.passingYards, settings.rushingYards, settings.receivingYards];
  const touchdownPoints = [
    settings.passingTouchdown,
    settings.rushingTouchdown,
    settings.receivingTouchdown,
  ];
  const isValid = yardagePoints.every(points => Number.isFinite(points) && points >= 0) &&
    touchdownPoints.every(points => Number.isFinite(points) && points > 0) &&
    Number.isFinite(settings.reception) && settings.reception >= 0;

  return {
    key: "scoring",
    label: "Scoring",
    status: isValid ? "pass" : "fail",
    severity: "blocker",
    message: isValid
      ? "League scoring is configured."
      : "Touchdown points must be greater than 0, and reception points cannot be negative.",
  };
};

export const validateRosterSlots = (rules: RosterRules): LeagueSeasonReadinessCheck => {
  const lineupEntries = Object.entries(rules.lineup);
  const hasValidCounts = Number.isInteger(rules.rosterSize)
    && rules.rosterSize > 0
    && Number.isInteger(rules.lineupSlotCount)
    && rules.lineupSlotCount > 0
    && lineupEntries.length > 0
    && lineupEntries.every(([slot, count]) =>
      slot.trim().length > 0 && Number.isInteger(count) && count > 0
    );
  const actualLineupSlotCount = lineupEntries.reduce((total, [, count]) => total + count, 0);
  const declaredCountsMatch = actualLineupSlotCount === rules.lineupSlotCount;
  const rosterMatchesLineup = rules.rosterSize === rules.lineupSlotCount;
  const isValid = hasValidCounts && declaredCountsMatch && rosterMatchesLineup;

  let message = `${rules.rosterSize} roster slots match the lineup settings.`;
  if (!hasValidCounts || !declaredCountsMatch) {
    message = "Roster size and every lineup slot must be positive whole numbers, and lineup slots must total the roster size.";
  } else if (!rosterMatchesLineup) {
    message = `Roster size is ${rules.rosterSize}, but lineup slots add up to ${rules.lineupSlotCount}.`;
  }

  return {
    key: "roster-slots",
    label: "Roster slots",
    status: isValid ? "pass" : "fail",
    severity: "blocker",
    message,
  };
};

export const validateRosterMaximums = (rules: RosterRules): LeagueSeasonReadinessCheck => {
  const positions = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
  const maximums = positions.map(position => rules.rosterMaximums[position]);
  const hasValidMaximums = maximums.every(maximum =>
    Number.isInteger(maximum) && maximum >= 0
  );
  const canFillRoster = maximums.reduce((total, maximum) => total + maximum, 0) >= rules.rosterSize;
  const directPositionSlotsFit = positions.every(position => {
    const slotCount = rules.lineup[position];
    return slotCount === undefined || slotCount <= rules.rosterMaximums[position];
  });
  const isValid = hasValidMaximums && canFillRoster && directPositionSlotsFit;

  return {
    key: "roster-maximums",
    label: "Roster maximums",
    status: isValid ? "pass" : "fail",
    severity: "blocker",
    message: isValid
      ? "Roster maximums are configured for every position."
      : "Roster maximums must be non-negative whole numbers and must support a full roster.",
  };
};

export const validatePublishLockState = (
  season: AnyLeagueSeason,
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

export const assessLeagueSeasonReadiness = (season: AnyLeagueSeason): LeagueSeasonReadiness => {
  const formatCheck = season.settings.draftFormat === "snake"
    ? validateSnakeDraft(season.settings.snake, season.teams, season.settings.roster.rosterSize)
    : validateAuctionBudget(season.settings.auction, season.settings.roster.rosterSize);
  const setupChecks = [
    validateTeamCount(season),
    formatCheck,
    validateScoringSettings(season.settings.scoring ?? defaultScoringSettings),
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
