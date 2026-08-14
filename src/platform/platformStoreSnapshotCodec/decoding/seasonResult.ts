import type {
  SeasonSimulationPlayerExposure,
  SeasonSimulationPositionCount,
  SeasonSimulationResult,
  SeasonSimulationRosterPlayer,
  SeasonSimulationRunResult,
  SeasonSimulationTeamResult,
} from "../../seasonSimulationEngine.js";
import { preferenceOutcomeValue, targetOutcomeValue } from "./seasonOutcomes.js";
import { seasonStrategyValue } from "./seasonStrategy.js";
import {
  arrayValue,
  booleanValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const exposureValue = (value: unknown, path: string): SeasonSimulationPlayerExposure => {
  const record = recordValue(value, path);
  return {
    playerId: stringValue(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: stringValue(record.position, `${path}.position`),
    count: integerValue(record.count, `${path}.count`),
    rate: numberValue(record.rate, `${path}.rate`),
    averagePrice: optionalValue(record.averagePrice, `${path}.averagePrice`, numberValue),
    averagePick: optionalValue(record.averagePick, `${path}.averagePick`, numberValue),
  };
};

const rosterPlayerValue = (value: unknown, path: string): SeasonSimulationRosterPlayer => {
  const record = recordValue(value, path);
  const source = record.source;
  if (source !== "ai" && source !== "human" && source !== "keeper") {
    return invalidSnapshot(`${path}.source`);
  }
  return {
    playerId: stringValue(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: stringValue(record.position, `${path}.position`),
    source,
    price: optionalValue(record.price, `${path}.price`, numberValue),
    overallPick: optionalValue(record.overallPick, `${path}.overallPick`, integerValue),
    round: optionalValue(record.round, `${path}.round`, integerValue),
    rosterSlot: stringValue(record.rosterSlot, `${path}.rosterSlot`),
    starter: booleanValue(record.starter, `${path}.starter`),
    week1Points: numberValue(record.week1Points, `${path}.week1Points`),
  };
};

const teamValue = (value: unknown, path: string): SeasonSimulationTeamResult => {
  const record = recordValue(value, path);
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    teamName: stringValue(record.teamName, `${path}.teamName`),
    isUserTeam: booleanValue(record.isUserTeam, `${path}.isUserTeam`),
    roster: arrayValue(record.roster, `${path}.roster`, rosterPlayerValue),
    week1Points: numberValue(record.week1Points, `${path}.week1Points`),
    spent: optionalValue(record.spent, `${path}.spent`, numberValue),
    budgetRemaining: optionalValue(record.budgetRemaining, `${path}.budgetRemaining`, numberValue),
  };
};

const runValue = (value: unknown, path: string): SeasonSimulationRunResult => {
  const record = recordValue(value, path);
  return {
    runNumber: integerValue(record.runNumber, `${path}.runNumber`),
    label: stringValue(record.label, `${path}.label`),
    seed: stringValue(record.seed, `${path}.seed`),
    teams: arrayValue(record.teams, `${path}.teams`, teamValue),
  };
};

const positionCountsValue = (
  value: unknown,
  path: string,
): Readonly<Record<string, SeasonSimulationPositionCount>> => {
  const record = recordValue(value, path);
  const result: Record<string, SeasonSimulationPositionCount> = {};
  for (const [key, child] of Object.entries(record)) {
    const count = recordValue(child, `${path}.${key}`);
    result[key] = {
      total: integerValue(count.total, `${path}.${key}.total`),
      perRun: numberValue(count.perRun, `${path}.${key}.perRun`),
    };
  }
  return result;
};

export const seasonResultValue = (value: unknown, path: string): SeasonSimulationResult => {
  const record = recordValue(value, path);
  const draftFormat = record.draftFormat;
  if (draftFormat !== "auction" && draftFormat !== "snake") {
    return invalidSnapshot(`${path}.draftFormat`);
  }
  return {
    draftFormat,
    runCount: integerValue(record.runCount, `${path}.runCount`),
    completedCount: integerValue(record.completedCount, `${path}.completedCount`),
    seedPrefix: stringValue(record.seedPrefix, `${path}.seedPrefix`),
    strategy: seasonStrategyValue(record.strategy, `${path}.strategy`),
    targetOutcomes: optionalValue(record.targetOutcomes, `${path}.targetOutcomes`, (candidate, candidatePath) =>
      arrayValue(candidate, candidatePath, targetOutcomeValue)),
    targetOutcome: optionalValue(record.targetOutcome, `${path}.targetOutcome`, targetOutcomeValue),
    preferenceOutcomes: optionalValue(record.preferenceOutcomes, `${path}.preferenceOutcomes`, (candidate, candidatePath) =>
      arrayValue(candidate, candidatePath, preferenceOutcomeValue)),
    playerExposure: arrayValue(record.playerExposure, `${path}.playerExposure`, exposureValue),
    positionCounts: positionCountsValue(record.positionCounts, `${path}.positionCounts`),
    runs: arrayValue(record.runs, `${path}.runs`, runValue),
  };
};
