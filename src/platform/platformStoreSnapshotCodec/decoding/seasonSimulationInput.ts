import type { RunSeasonSimulationsInput } from "../../seasonSimulationEngine.js";
import type { SeasonSimulationTargetConstraint } from "../../seasonSimulationTargets.js";
import { historicalSaleValue } from "./historical.js";
import { optionalString } from "./leaguePrimitives.js";
import { explicitSeasonValue, liveRoomSetupValue } from "./liveRooms.js";
import {
  arrayValue,
  integerValue,
  numberValue,
  numericRecordValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const targetValue = (value: unknown, path: string): SeasonSimulationTargetConstraint => {
  const record = recordValue(value, path);
  return {
    playerName: stringValue(record.playerName, `${path}.playerName`),
    maxAuctionPrice: optionalValue(record.maxAuctionPrice, `${path}.maxAuctionPrice`, numberValue),
    maxSnakeRound: optionalValue(record.maxSnakeRound, `${path}.maxSnakeRound`, integerValue),
    maxSnakeOverallPick: optionalValue(
      record.maxSnakeOverallPick,
      `${path}.maxSnakeOverallPick`,
      integerValue,
    ),
  };
};

export const seasonSimulationInputValue = (
  value: unknown,
  path: string,
): RunSeasonSimulationsInput => {
  const record = recordValue(value, path);
  return {
    season: explicitSeasonValue(record.season, `${path}.season`),
    setup: liveRoomSetupValue(record.setup, `${path}.setup`),
    humanTeamId: stringValue(record.humanTeamId, `${path}.humanTeamId`),
    runCount: integerValue(record.runCount, `${path}.runCount`),
    strategyInput: optionalString(record.strategyInput, `${path}.strategyInput`),
    targetConstraints: optionalValue(record.targetConstraints, `${path}.targetConstraints`,
      (candidate, candidatePath) => arrayValue(candidate, candidatePath, targetValue)),
    seedPrefix: optionalString(record.seedPrefix, `${path}.seedPrefix`),
    playerExpectedPrices: optionalValue(
      record.playerExpectedPrices,
      `${path}.playerExpectedPrices`,
      numericRecordValue,
    ),
    playerHumanValues: optionalValue(
      record.playerHumanValues,
      `${path}.playerHumanValues`,
      numericRecordValue,
    ),
    week1Projections: optionalValue(
      record.week1Projections,
      `${path}.week1Projections`,
      numericRecordValue,
    ),
    historicalSaleRecords: optionalValue(
      record.historicalSaleRecords,
      `${path}.historicalSaleRecords`,
      (candidate, candidatePath) => arrayValue(candidate, candidatePath, historicalSaleValue),
    ),
  };
};
