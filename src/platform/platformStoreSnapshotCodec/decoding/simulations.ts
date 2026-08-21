import type { ForcedAuctionSale } from "../../../modeling/mockBatch.js";
import type {
  SimulationHardLock,
  SimulationRequest,
  SimulationResult,
  SimulationRun,
  SimulationRunStatus,
  SimulationSoftTarget,
} from "../../simulations.js";
import { seasonSimulationInputValue } from "./seasonSimulationInput.js";
import { optionalString } from "./leaguePrimitives.js";
import { mockSummaryValue } from "./mockSummary.js";
import {
  arrayValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringArrayValue,
  stringValue,
} from "./primitives.js";
import { seasonResultValue } from "./seasonResult.js";

const hardLockValue = (value: unknown, path: string): SimulationHardLock => {
  const record = recordValue(value, path);
  const priceMode = record.priceMode;
  if (priceMode !== "exact" && priceMode !== "ceiling") return invalidSnapshot(`${path}.priceMode`);
  return {
    playerName: stringValue(record.playerName, `${path}.playerName`),
    price: numberValue(record.price, `${path}.price`),
    priceMode,
    auctionOwner: optionalString(record.auctionOwner, `${path}.auctionOwner`),
  };
};

const softTargetValue = (value: unknown, path: string): SimulationSoftTarget => {
  const record = recordValue(value, path);
  return {
    label: stringValue(record.label, `${path}.label`),
    candidatePool: stringArrayValue(record.candidatePool, `${path}.candidatePool`),
    maxBid: numberValue(record.maxBid, `${path}.maxBid`),
  };
};

const requestValue = (value: unknown, path: string): SimulationRequest => {
  const record = recordValue(value, path);
  const strategy = recordValue(record.strategy, `${path}.strategy`);
  const browserInput = record.browserInput;
  const browserInputDigest = record.browserInputDigest;
  const browserNote = record.browserNote;
  return {
    id: stringValue(record.id, `${path}.id`),
    userId: stringValue(record.userId, `${path}.userId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    teamId: stringValue(record.teamId, `${path}.teamId`),
    count: integerValue(record.count, `${path}.count`),
    seedPrefix: stringValue(record.seedPrefix, `${path}.seedPrefix`),
    idempotencyKey: stringValue(record.idempotencyKey, `${path}.idempotencyKey`),
    strategy: {
      hardLocks: arrayValue(strategy.hardLocks, `${path}.strategy.hardLocks`, hardLockValue),
      softTargets: arrayValue(strategy.softTargets, `${path}.strategy.softTargets`, softTargetValue),
    },
    privacyOwnerUserId: stringValue(record.privacyOwnerUserId, `${path}.privacyOwnerUserId`),
    inputHash: stringValue(record.inputHash, `${path}.inputHash`),
    ...(browserInput === undefined ? {} : {
      browserInput: seasonSimulationInputValue(browserInput, `${path}.browserInput`),
    }),
    ...(typeof browserInputDigest === "string" ? { browserInputDigest } : {}),
    ...(typeof browserNote === "string" ? { browserNote } : {}),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
  };
};

const forcedSaleValue = (value: unknown, path: string): ForcedAuctionSale => {
  const record = recordValue(value, path);
  return {
    owner: stringValue(record.owner, `${path}.owner`),
    player: stringValue(record.player, `${path}.player`),
    price: numberValue(record.price, `${path}.price`),
  };
};

const resultValue = (value: unknown, path: string): SimulationResult => {
  const record = recordValue(value, path);
  const favoriteRunNumbers = optionalValue(
    record.favoriteRunNumbers,
    `${path}.favoriteRunNumbers`,
    (candidate, candidatePath) => arrayValue(candidate, candidatePath, integerValue),
  );
  return {
    runId: stringValue(record.runId, `${path}.runId`),
    requestId: stringValue(record.requestId, `${path}.requestId`),
    completedAt: dateValue(record.completedAt, `${path}.completedAt`),
    runCount: integerValue(record.runCount, `${path}.runCount`),
    seedPrefix: stringValue(record.seedPrefix, `${path}.seedPrefix`),
    hardLockCount: integerValue(record.hardLockCount, `${path}.hardLockCount`),
    softTargetCount: integerValue(record.softTargetCount, `${path}.softTargetCount`),
    forcedSales: arrayValue(record.forcedSales, `${path}.forcedSales`, forcedSaleValue),
    summary: mockSummaryValue(record.summary, `${path}.summary`),
    seasonSimulation: optionalValue(record.seasonSimulation, `${path}.seasonSimulation`, seasonResultValue),
    strategyText: optionalString(record.strategyText, `${path}.strategyText`),
    note: optionalString(record.note, `${path}.note`),
    ...(favoriteRunNumbers === undefined ? {} : { favoriteRunNumbers }),
  };
};

const statusValue = (value: unknown, path: string): SimulationRunStatus => {
  if (value === "requested" || value === "running" || value === "completed"
    || value === "failed" || value === "canceled") return value;
  return invalidSnapshot(path);
};

export const simulationRunValue = (value: unknown, path: string): SimulationRun => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    request: requestValue(record.request, `${path}.request`),
    status: statusValue(record.status, `${path}.status`),
    privacyOwnerUserId: stringValue(record.privacyOwnerUserId, `${path}.privacyOwnerUserId`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    startedAt: optionalValue(record.startedAt, `${path}.startedAt`, dateValue),
    completedAt: optionalValue(record.completedAt, `${path}.completedAt`, dateValue),
    result: optionalValue(record.result, `${path}.result`, resultValue),
  };
};
