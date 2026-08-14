import type {
  MockBatchSummary,
  OwnerBatchSummary,
  OwnerPlayerExposureSummary,
  PlayerBatchSummary,
  ScenarioBatchSummary,
} from "../../../modeling/mockBatch.js";
import { positionValue } from "./leaguePrimitives.js";
import {
  arrayValue,
  integerValue,
  numberValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const positionAmountsValue = (value: unknown, path: string) => {
  const record = recordValue(value, path);
  return {
    QB: numberValue(record.QB, `${path}.QB`),
    RB: numberValue(record.RB, `${path}.RB`),
    WR: numberValue(record.WR, `${path}.WR`),
    TE: numberValue(record.TE, `${path}.TE`),
    K: numberValue(record.K, `${path}.K`),
    DST: numberValue(record.DST, `${path}.DST`),
  };
};

const scenarioValue = (value: unknown, path: string): ScenarioBatchSummary => {
  const record = recordValue(value, path);
  const key = record.key;
  if (key !== "confirmedOnly" && key !== "expected" && key !== "highRetention") {
    throw new Error(`Invalid platform store snapshot at ${path}.key.`);
  }
  return {
    key,
    label: stringValue(record.label, `${path}.label`),
    runCount: integerValue(record.runCount, `${path}.runCount`),
    invalidRosterCount: integerValue(record.invalidRosterCount, `${path}.invalidRosterCount`),
    averagePickCount: numberValue(record.averagePickCount, `${path}.averagePickCount`),
  };
};

const playerValue = (value: unknown, path: string): PlayerBatchSummary => {
  const record = recordValue(value, path);
  return {
    name: stringValue(record.name, `${path}.name`),
    position: positionValue(record.position, `${path}.position`),
    draftedCount: integerValue(record.draftedCount, `${path}.draftedCount`),
    draftedRate: numberValue(record.draftedRate, `${path}.draftedRate`),
    averageMarketPrice: numberValue(record.averageMarketPrice, `${path}.averageMarketPrice`),
    averageSalePrice: numberValue(record.averageSalePrice, `${path}.averageSalePrice`),
    minimumSalePrice: numberValue(record.minimumSalePrice, `${path}.minimumSalePrice`),
    maximumSalePrice: numberValue(record.maximumSalePrice, `${path}.maximumSalePrice`),
  };
};

const ownerValue = (value: unknown, path: string): OwnerBatchSummary => {
  const record = recordValue(value, path);
  return {
    owner: stringValue(record.owner, `${path}.owner`),
    runCount: integerValue(record.runCount, `${path}.runCount`),
    invalidRosterCount: integerValue(record.invalidRosterCount, `${path}.invalidRosterCount`),
    averageSpend: numberValue(record.averageSpend, `${path}.averageSpend`),
    minimumSpend: numberValue(record.minimumSpend, `${path}.minimumSpend`),
    maximumSpend: numberValue(record.maximumSpend, `${path}.maximumSpend`),
    averageWeek1Score: numberValue(record.averageWeek1Score, `${path}.averageWeek1Score`),
    averageWeeks1To4Score: numberValue(record.averageWeeks1To4Score, `${path}.averageWeeks1To4Score`),
    averageBudgetRemaining: numberValue(record.averageBudgetRemaining, `${path}.averageBudgetRemaining`),
    averagePositionSpend: positionAmountsValue(record.averagePositionSpend, `${path}.averagePositionSpend`),
  };
};

const exposureValue = (value: unknown, path: string): OwnerPlayerExposureSummary => {
  const record = recordValue(value, path);
  return {
    owner: stringValue(record.owner, `${path}.owner`),
    player: stringValue(record.player, `${path}.player`),
    position: positionValue(record.position, `${path}.position`),
    draftedCount: integerValue(record.draftedCount, `${path}.draftedCount`),
    draftedRate: numberValue(record.draftedRate, `${path}.draftedRate`),
    averagePrice: numberValue(record.averagePrice, `${path}.averagePrice`),
  };
};

export const mockSummaryValue = (value: unknown, path: string): MockBatchSummary => {
  const record = recordValue(value, path);
  return {
    runCount: integerValue(record.runCount, `${path}.runCount`),
    scenarios: arrayValue(record.scenarios, `${path}.scenarios`, scenarioValue),
    players: arrayValue(record.players, `${path}.players`, playerValue),
    owners: arrayValue(record.owners, `${path}.owners`, ownerValue),
    ownerPlayerExposure: arrayValue(record.ownerPlayerExposure, `${path}.ownerPlayerExposure`, exposureValue),
  };
};
