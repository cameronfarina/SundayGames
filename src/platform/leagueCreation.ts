import { randomUUID } from "node:crypto";

import type { Position } from "../../config/league.js";
import {
  assessLeagueSeasonReadiness,
  type AnyLeagueSeason,
  type FantasyTeam,
  type LeagueProvider,
  type LineupSettings,
  type RosterMaximums,
  type ScoringSettings,
} from "./leagueSeason.js";

export interface ConfirmedLeagueTeamInput {
  externalTeamId: string;
  displayName: string;
  abbreviation?: string | null;
  managerNames?: readonly string[];
}

export type ConfirmedLeagueDraftInput =
  | {
      type: "auction";
      budgetDollars: number;
      minimumBidDollars: number;
    }
  | {
      type: "snake";
      rounds: number;
      order: readonly string[];
      reversal?: "standard" | "third-round";
    };

export interface ConfirmedLeagueCreationInput {
  provider: LeagueProvider;
  externalLeagueId: string;
  leagueName: string;
  seasonYear: number;
  expectedTeamCount: number;
  teams: readonly ConfirmedLeagueTeamInput[];
  draft: ConfirmedLeagueDraftInput;
  scoring: ScoringSettings;
  rosterSlots: Readonly<Record<string, number>>;
}

export class LeagueCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeagueCreationError";
  }
}

const recordValue = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LeagueCreationError(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
};

const stringField = (record: Record<string, unknown>, key: string, label: string): string => {
  if (typeof record[key] !== "string") throw new LeagueCreationError(`${label} is required.`);
  return record[key];
};

const numberField = (record: Record<string, unknown>, key: string, label: string): number => {
  if (typeof record[key] !== "number") throw new LeagueCreationError(`${label} is required.`);
  return record[key];
};

export const confirmedLeagueCreationInputFromUnknown = (
  value: unknown,
): ConfirmedLeagueCreationInput => {
  const input = recordValue(value, "League setup");
  const provider = input.provider;
  if (provider !== "mockd" && provider !== "espn" && provider !== "sleeper" && provider !== "yahoo") {
    throw new LeagueCreationError("League provider is invalid.");
  }
  if (!Array.isArray(input.teams)) throw new LeagueCreationError("League teams are required.");
  const teams = input.teams.map((value, index): ConfirmedLeagueTeamInput => {
    const team = recordValue(value, `Team ${index + 1}`);
    const managerNames = team.managerNames;
    if (managerNames !== undefined && (!Array.isArray(managerNames) || managerNames.some(name => typeof name !== "string"))) {
      throw new LeagueCreationError(`Team ${index + 1} managers are invalid.`);
    }
    return {
      externalTeamId: stringField(team, "externalTeamId", `Team ${index + 1} external ID`),
      displayName: stringField(team, "displayName", `Team ${index + 1} name`),
      ...(typeof team.abbreviation === "string" ? { abbreviation: team.abbreviation } : {}),
      ...(managerNames === undefined ? {} : { managerNames: managerNames as string[] }),
    };
  });
  const draftRecord = recordValue(input.draft, "Draft settings");
  const draftType = draftRecord.type;
  let draft: ConfirmedLeagueDraftInput;
  if (draftType === "auction") {
    draft = {
      type: "auction",
      budgetDollars: numberField(draftRecord, "budgetDollars", "Auction budget"),
      minimumBidDollars: numberField(draftRecord, "minimumBidDollars", "Auction minimum bid"),
    };
  } else if (draftType === "snake") {
    if (!Array.isArray(draftRecord.order) || draftRecord.order.some(teamId => typeof teamId !== "string")) {
      throw new LeagueCreationError("Snake draft order is invalid.");
    }
    const reversal = draftRecord.reversal;
    if (reversal !== undefined && reversal !== "standard" && reversal !== "third-round") {
      throw new LeagueCreationError("Snake reversal is invalid.");
    }
    draft = {
      type: "snake",
      rounds: numberField(draftRecord, "rounds", "Snake rounds"),
      order: draftRecord.order as string[],
      ...(reversal === undefined ? {} : { reversal }),
    };
  } else {
    throw new LeagueCreationError("Draft type must be auction or snake.");
  }
  const scoring = recordValue(input.scoring, "Scoring settings");
  const rosterSlotsRecord = recordValue(input.rosterSlots, "Roster slots");
  const rosterSlots = Object.fromEntries(Object.entries(rosterSlotsRecord).map(([slot, count]) => {
    if (typeof count !== "number") throw new LeagueCreationError(`Roster slot ${slot} is invalid.`);
    return [slot, count];
  }));

  return {
    provider,
    externalLeagueId: stringField(input, "externalLeagueId", "External league ID"),
    leagueName: stringField(input, "leagueName", "League name"),
    seasonYear: numberField(input, "seasonYear", "Season"),
    expectedTeamCount: numberField(input, "expectedTeamCount", "Team count"),
    teams,
    draft,
    scoring: {
      passingYards: numberField(scoring, "passingYards", "Passing yard scoring"),
      passingTouchdown: numberField(scoring, "passingTouchdown", "Passing touchdown scoring"),
      rushingYards: numberField(scoring, "rushingYards", "Rushing yard scoring"),
      rushingTouchdown: numberField(scoring, "rushingTouchdown", "Rushing touchdown scoring"),
      receivingYards: numberField(scoring, "receivingYards", "Receiving yard scoring"),
      receivingTouchdown: numberField(scoring, "receivingTouchdown", "Receiving touchdown scoring"),
      reception: numberField(scoring, "reception", "Reception scoring"),
    },
    rosterSlots,
  };
};

const positions = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];
const allPositions = [...positions] as const;
const offensivePositions = ["QB", "RB", "WR", "TE"] as const satisfies readonly Position[];

interface RosterSlotDefinition {
  canonicalSlot: string;
  draftable: boolean;
  eligiblePositions: readonly Position[];
}

export interface DraftableRosterSlotAnalysis {
  slot: string;
  count: number;
  eligiblePositions: readonly Position[];
}

export interface RosterSlotAnalysis {
  draftableSlots: readonly DraftableRosterSlotAnalysis[];
  draftCapacity: number;
  rosterMaximums: RosterMaximums;
  unsupportedSlots: readonly string[];
}

const rosterSlotDefinitions: Readonly<Record<string, RosterSlotDefinition>> = {
  QB: { canonicalSlot: "QB", draftable: true, eligiblePositions: ["QB"] },
  RB: { canonicalSlot: "RB", draftable: true, eligiblePositions: ["RB"] },
  WR: { canonicalSlot: "WR", draftable: true, eligiblePositions: ["WR"] },
  TE: { canonicalSlot: "TE", draftable: true, eligiblePositions: ["TE"] },
  K: { canonicalSlot: "K", draftable: true, eligiblePositions: ["K"] },
  DST: { canonicalSlot: "DST", draftable: true, eligiblePositions: ["DST"] },
  D_ST: { canonicalSlot: "DST", draftable: true, eligiblePositions: ["DST"] },
  FLEX: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  RB_WR_TE: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  W_R_T: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  RB_WR: { canonicalSlot: "RB_WR", draftable: true, eligiblePositions: ["RB", "WR"] },
  R_W: { canonicalSlot: "RB_WR", draftable: true, eligiblePositions: ["RB", "WR"] },
  WR_TE: { canonicalSlot: "WR_TE", draftable: true, eligiblePositions: ["WR", "TE"] },
  W_T: { canonicalSlot: "WR_TE", draftable: true, eligiblePositions: ["WR", "TE"] },
  OP: { canonicalSlot: "OP", draftable: true, eligiblePositions: offensivePositions },
  SUPERFLEX: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  SUPER_FLEX: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  Q_W_R_T: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  BENCH: { canonicalSlot: "BENCH", draftable: true, eligiblePositions: allPositions },
  BE: { canonicalSlot: "BENCH", draftable: true, eligiblePositions: allPositions },
  IR: { canonicalSlot: "IR", draftable: false, eligiblePositions: [] },
  RESERVE: { canonicalSlot: "IR", draftable: false, eligiblePositions: [] },
};

const normalizedRosterSlotKey = (slot: string): string =>
  slot.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");

export const analyzeRosterSlots = (
  lineup: Readonly<Record<string, number>>,
): RosterSlotAnalysis => {
  const draftableSlots: DraftableRosterSlotAnalysis[] = [];
  const unsupportedSlots: string[] = [];
  const rosterMaximums: RosterMaximums = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };

  for (const [slot, count] of Object.entries(lineup)) {
    if (!Number.isInteger(count) || count <= 0) continue;
    const definition = rosterSlotDefinitions[normalizedRosterSlotKey(slot)];
    if (definition === undefined) {
      unsupportedSlots.push(slot);
      continue;
    }
    if (!definition.draftable) continue;

    const configuredSlot = draftableSlots.find(candidate => candidate.slot === definition.canonicalSlot);
    if (configuredSlot === undefined) {
      draftableSlots.push({
        slot: definition.canonicalSlot,
        count,
        eligiblePositions: definition.eligiblePositions,
      });
    } else {
      configuredSlot.count += count;
    }
    for (const position of definition.eligiblePositions) rosterMaximums[position] += count;
  }

  return {
    draftableSlots,
    draftCapacity: draftableSlots.reduce((total, slot) => total + slot.count, 0),
    rosterMaximums,
    unsupportedSlots,
  };
};

const requiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) throw new LeagueCreationError(`${label} is required.`);
  return normalized;
};

const positiveInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new LeagueCreationError(`${label} must be a positive whole number.`);
  }
  return value;
};

const lineupFor = (rosterSlots: Readonly<Record<string, number>>): LineupSettings => {
  const importedLineup: LineupSettings = {};
  for (const [slot, count] of Object.entries(rosterSlots)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new LeagueCreationError(`Roster slot ${slot} must be a non-negative whole number.`);
    }
    if (count > 0) importedLineup[slot] = count;
  }
  if (Object.keys(importedLineup).length === 0) throw new LeagueCreationError("At least one roster slot is required.");
  const analysis = analyzeRosterSlots(importedLineup);
  const unsupportedSlot = analysis.unsupportedSlots[0];
  if (unsupportedSlot !== undefined) {
    throw new LeagueCreationError(
      `Unsupported roster slot ${unsupportedSlot}. Review the roster settings before continuing.`,
    );
  }
  if (analysis.draftCapacity === 0) {
    throw new LeagueCreationError("At least one draftable roster slot is required.");
  }

  return analysis.draftableSlots.reduce<LineupSettings>((lineup, slot) => ({
    ...lineup,
    [slot.slot]: (lineup[slot.slot] ?? 0) + slot.count,
  }), {});
};

export const createLeagueSeasonFromConfirmedSetup = (
  input: ConfirmedLeagueCreationInput,
  createId: () => string = randomUUID,
): AnyLeagueSeason => {
  const leagueName = requiredText(input.leagueName, "League name");
  const externalLeagueId = requiredText(input.externalLeagueId, "External league ID");
  const expectedTeamCount = positiveInteger(input.expectedTeamCount, "Team count");
  const seasonYear = positiveInteger(input.seasonYear, "Season");
  if (input.teams.length !== expectedTeamCount) {
    throw new LeagueCreationError(`Expected ${expectedTeamCount} teams, but received ${input.teams.length}.`);
  }

  const externalTeamIds = new Set<string>();
  const leagueId = `league-${createId()}`;
  const seasonId = `season-${createId()}`;
  const teams: FantasyTeam[] = input.teams.map((team, index) => {
    const externalTeamId = requiredText(team.externalTeamId, "External team ID");
    if (externalTeamIds.has(externalTeamId)) {
      throw new LeagueCreationError(`External team ID ${externalTeamId} is duplicated.`);
    }
    externalTeamIds.add(externalTeamId);
    const displayName = requiredText(team.displayName, "Team name");
    const managerDisplayNames = (team.managerNames ?? [])
      .map(name => name.trim())
      .filter(Boolean);

    return {
      id: `team-${createId()}`,
      leagueSeasonId: seasonId,
      ownerId: `owner-${createId()}`,
      ownerDisplayName: managerDisplayNames[0] ?? displayName,
      ...(managerDisplayNames.length === 0 ? {} : { managerDisplayNames }),
      ...(team.abbreviation === undefined || team.abbreviation === null || team.abbreviation.trim() === ""
        ? {}
        : { abbreviation: team.abbreviation.trim() }),
      displayName,
      draftOrderPosition: index + 1,
    };
  });
  const teamIdByExternalId = new Map(input.teams.map((team, index) => [team.externalTeamId.trim(), teams[index]?.id]));
  const lineup = lineupFor(input.rosterSlots);
  const rosterAnalysis = analyzeRosterSlots(lineup);
  const rosterSize = rosterAnalysis.draftCapacity;
  const sharedSettings = {
    expectedTeamCount,
    scoring: { ...input.scoring },
    roster: {
      rosterSize,
      lineup,
      lineupSlotCount: rosterSize,
      rosterMaximums: rosterAnalysis.rosterMaximums,
    },
    keeperPolicy: {
      mode: "previous-cost-multiplier" as const,
      multiplier: 1.2,
      rounding: "ceil" as const,
    },
  };
  const settings = input.draft.type === "auction"
    ? {
        ...sharedSettings,
        draftFormat: "auction" as const,
        auction: {
          budgetDollars: input.draft.budgetDollars,
          minimumBidDollars: input.draft.minimumBidDollars,
        },
      }
    : {
        ...sharedSettings,
        draftFormat: "snake" as const,
        snake: {
          rounds: input.draft.rounds,
          reversal: input.draft.reversal ?? "standard",
          order: input.draft.order.map(externalTeamId => {
            const teamId = teamIdByExternalId.get(externalTeamId.trim());
            if (teamId === undefined) {
              throw new LeagueCreationError(`Snake order references unknown team ${externalTeamId}.`);
            }
            return teamId;
          }),
        },
      };
  const season: AnyLeagueSeason = {
    id: seasonId,
    league: {
      id: leagueId,
      externalLeagueId,
      name: leagueName,
      provider: input.provider,
    },
    leagueId,
    seasonYear,
    teams,
    settings,
    setupStatus: "draft",
  };
  const readiness = assessLeagueSeasonReadiness(season);
  if (readiness.blockers.length > 0) throw new LeagueCreationError(readiness.blockers[0] ?? "League setup is invalid.");

  return season;
};
