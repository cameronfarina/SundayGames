import type {
  PlayerPriceSnapshotRow,
  PricingExplanationRef,
  PricingInputSnapshot,
  PricingSnapshot,
} from "../../pricingSnapshots.js";
import { optionalString, positionValue } from "./leaguePrimitives.js";
import {
  arrayValue,
  numberValue,
  optionalValue,
  recordValue,
  stringArrayValue,
  stringValue,
} from "./primitives.js";

const inputSnapshotValue = (value: unknown, path: string): PricingInputSnapshot => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    hash: stringValue(record.hash, `${path}.hash`),
  };
};

const explanationValue = (value: unknown, path: string): PricingExplanationRef => {
  const record = recordValue(value, path);
  return {
    modelRunId: stringValue(record.modelRunId, `${path}.modelRunId`),
    modelVersion: stringValue(record.modelVersion, `${path}.modelVersion`),
    scenarioId: stringValue(record.scenarioId, `${path}.scenarioId`),
    inputSnapshotId: stringValue(record.inputSnapshotId, `${path}.inputSnapshotId`),
    playerKey: stringValue(record.playerKey, `${path}.playerKey`),
  };
};

const rowValue = (value: unknown, path: string): PlayerPriceSnapshotRow => {
  const record = recordValue(value, path);
  const confidence = optionalValue(record.confidence, `${path}.confidence`, numberValue);
  const tier = optionalString(record.tier, `${path}.tier`);
  const strategyOverlayId = optionalString(
    record.strategyOverlayId,
    `${path}.strategyOverlayId`,
  );
  return {
    playerKey: stringValue(record.playerKey, `${path}.playerKey`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    normalizedName: stringValue(record.normalizedName, `${path}.normalizedName`),
    position: positionValue(record.position, `${path}.position`),
    marketPrice: numberValue(record.marketPrice, `${path}.marketPrice`),
    scenarioPrice: numberValue(record.scenarioPrice, `${path}.scenarioPrice`),
    livePrice: numberValue(record.livePrice, `${path}.livePrice`),
    personalValue: numberValue(record.personalValue, `${path}.personalValue`),
    recommendedMaxBid: numberValue(record.recommendedMaxBid, `${path}.recommendedMaxBid`),
    warnings: stringArrayValue(record.warnings, `${path}.warnings`),
    explanationRef: explanationValue(record.explanationRef, `${path}.explanationRef`),
    ...(confidence === undefined ? {} : { confidence }),
    ...(tier === undefined ? {} : { tier }),
    ...(strategyOverlayId === undefined ? {} : { strategyOverlayId }),
  };
};

const seasonYearValue = (value: unknown, path: string): number | string =>
  typeof value === "number" ? numberValue(value, path) : stringValue(value, path);

export const pricingSnapshotValue = (value: unknown, path: string): PricingSnapshot => {
  const record = recordValue(value, path);
  const createdAt = optionalString(record.createdAt, `${path}.createdAt`);
  const strategyOverlayId = optionalString(
    record.strategyOverlayId,
    `${path}.strategyOverlayId`,
  );
  return {
    snapshotId: stringValue(record.snapshotId, `${path}.snapshotId`),
    modelRunId: stringValue(record.modelRunId, `${path}.modelRunId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonYear: seasonYearValue(record.seasonYear, `${path}.seasonYear`),
    modelVersion: stringValue(record.modelVersion, `${path}.modelVersion`),
    scenarioId: stringValue(record.scenarioId, `${path}.scenarioId`),
    inputSnapshot: inputSnapshotValue(record.inputSnapshot, `${path}.inputSnapshot`),
    rows: arrayValue(record.rows, `${path}.rows`, rowValue),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(strategyOverlayId === undefined ? {} : { strategyOverlayId }),
  };
};
