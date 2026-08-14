import type {
  ParsedSeasonSimulationStrategy,
  SeasonSimulationPositionCap,
} from "../../seasonSimulationEngine.js";
import type { SeasonSimulationPreferredPosition } from "../../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../../seasonSimulationTargets.js";
import { optionalString } from "./leaguePrimitives.js";
import {
  arrayValue,
  booleanValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringArrayValue,
  stringValue,
} from "./primitives.js";

const offensivePosition = (value: unknown, path: string): "QB" | "RB" | "WR" | "TE" => {
  if (value === "QB" || value === "RB" || value === "WR" || value === "TE") return value;
  return invalidSnapshot(path);
};

export const targetConstraintValue = (
  value: unknown,
  path: string,
): SeasonSimulationTargetConstraint => {
  const record = recordValue(value, path);
  return {
    playerName: stringValue(record.playerName, `${path}.playerName`),
    maxAuctionPrice: optionalValue(record.maxAuctionPrice, `${path}.maxAuctionPrice`, numberValue),
    maxSnakeRound: optionalValue(record.maxSnakeRound, `${path}.maxSnakeRound`, integerValue),
    maxSnakeOverallPick: optionalValue(record.maxSnakeOverallPick, `${path}.maxSnakeOverallPick`, integerValue),
  };
};

const preferenceValue = (value: unknown, path: string): SeasonSimulationPreferredPosition => {
  const record = recordValue(value, path);
  if (record.tier !== "elite") return invalidSnapshot(`${path}.tier`);
  return {
    position: offensivePosition(record.position, `${path}.position`),
    tier: record.tier,
    targetCount: optionalValue(record.targetCount, `${path}.targetCount`, integerValue),
    maxAuctionPrice: optionalValue(record.maxAuctionPrice, `${path}.maxAuctionPrice`, numberValue),
  };
};

const positionCapValue = (value: unknown, path: string): SeasonSimulationPositionCap => {
  const record = recordValue(value, path);
  return {
    position: offensivePosition(record.position, `${path}.position`),
    maxAuctionPrice: numberValue(record.maxAuctionPrice, `${path}.maxAuctionPrice`),
    excludeNamedTargets: booleanValue(record.excludeNamedTargets, `${path}.excludeNamedTargets`),
  };
};

export const seasonStrategyValue = (
  value: unknown,
  path: string,
): ParsedSeasonSimulationStrategy => {
  const record = recordValue(value, path);
  return {
    rawInput: stringValue(record.rawInput, `${path}.rawInput`),
    targets: optionalValue(record.targets, `${path}.targets`, (candidate, candidatePath) =>
      arrayValue(candidate, candidatePath, targetConstraintValue)),
    target: optionalValue(record.target, `${path}.target`, targetConstraintValue),
    preferredPositions: arrayValue(record.preferredPositions, `${path}.preferredPositions`, preferenceValue),
    positionCaps: optionalValue(record.positionCaps, `${path}.positionCaps`, (candidate, candidatePath) =>
      arrayValue(candidate, candidatePath, positionCapValue)),
    pairWithPlayerName: optionalString(record.pairWithPlayerName, `${path}.pairWithPlayerName`),
    summary: stringValue(record.summary, `${path}.summary`),
    warnings: stringArrayValue(record.warnings, `${path}.warnings`),
  };
};
