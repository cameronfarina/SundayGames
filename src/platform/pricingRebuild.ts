import type { Position } from "../../config/league.js";
import type { HistoricalSaleRecord } from "./historicalImports.js";
import {
  createPricingInputSnapshot,
  createPricingSnapshot,
  type PricingSnapshot,
  type PricingSourcePrice,
} from "./pricingSnapshots.js";

export interface CreateLeagueCalibratedPricingSnapshotsInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioIds: readonly string[];
  baselinePrices: readonly PricingSourcePrice[];
  historicalSaleRecords: readonly HistoricalSaleRecord[];
  currentAuctionBudget?: number;
  currentTeamCount?: number;
  keeperLockedSpend?: number;
  createdAt?: string;
}

interface CalibrationResult {
  price: number;
  historicalMove: number;
}

const BALANCED_SCENARIO_ID = "balanced";
const HISTORICAL_BLEND_WEIGHT = 0.5;
const MATERIAL_HISTORICAL_MOVE_DOLLARS = 5;
const RECENT_SEASON_COUNT = 3;
const SCENARIO_MULTIPLIER_FLOOR = 0.95;
const SCENARIO_MULTIPLIER_STEP = 0.01;
const SCENARIO_MULTIPLIER_BUCKETS = 11;

const normalizePlayerName = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const playerHistoryKey = (normalizedName: string, position: Position): string =>
  `${normalizePlayerName(normalizedName)}\0${position}`;

const clampWholeDollars = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.round(value));
};

const average = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined;

  return values.reduce((total, value) => total + value, 0) / values.length;
};

const hashString = (value: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const scenarioMultiplierFor = (scenarioId: string): number => {
  if (scenarioId === BALANCED_SCENARIO_ID) return 1;

  return SCENARIO_MULTIPLIER_FLOOR
    + (hashString(scenarioId) % SCENARIO_MULTIPLIER_BUCKETS) * SCENARIO_MULTIPLIER_STEP;
};

const normalizedScenarioIds = (scenarioIds: readonly string[]): readonly string[] => {
  const normalized = scenarioIds
    .map(scenarioId => scenarioId.trim())
    .filter(scenarioId => scenarioId.length > 0);
  const uniqueScenarioIds = [...new Set(normalized)];

  return uniqueScenarioIds.length > 0 ? uniqueScenarioIds : [BALANCED_SCENARIO_ID];
};

const recentAuctionSales = (
  records: readonly HistoricalSaleRecord[],
  leagueId: string,
  seasonYear: number | string,
): readonly HistoricalSaleRecord[] => {
  const currentSeasonYear = Number(seasonYear);
  const eligibleRecords = records.filter(record =>
    record.leagueId === leagueId
      && (!Number.isFinite(currentSeasonYear) || record.seasonYear <= currentSeasonYear)
      && record.acquisitionType === "auction"
      && !record.keeper
      && Number.isFinite(record.priceDollars)
      && record.priceDollars >= 0
  );

  const latestSeasonYear = Math.max(...eligibleRecords.map(record => record.seasonYear));
  if (!Number.isFinite(latestSeasonYear)) return [];

  const oldestIncludedSeasonYear = latestSeasonYear - RECENT_SEASON_COUNT + 1;

  return eligibleRecords.filter(record => record.seasonYear >= oldestIncludedSeasonYear);
};

const addMapValue = <K>(map: Map<K, number[]>, key: K, value: number): void => {
  const values = map.get(key);
  if (values === undefined) {
    map.set(key, [value]);
    return;
  }

  values.push(value);
};

const positionAverages = (
  prices: readonly PricingSourcePrice[],
): ReadonlyMap<Position, number> => {
  const pricesByPosition = new Map<Position, number[]>();
  for (const price of prices) {
    addMapValue(pricesByPosition, price.position, clampWholeDollars(price.price));
  }

  return new Map([...pricesByPosition].flatMap(([position, values]) => {
    const positionAverage = average(values);

    return positionAverage === undefined ? [] : [[position, positionAverage]];
  }));
};

const createPlayerHistory = (
  sales: readonly HistoricalSaleRecord[],
): ReadonlyMap<string, number[]> => {
  const history = new Map<string, number[]>();

  for (const sale of sales) {
    addMapValue(history, playerHistoryKey(sale.playerName, sale.position), sale.priceDollars);
  }

  return history;
};

const createPositionHistory = (
  sales: readonly HistoricalSaleRecord[],
): ReadonlyMap<Position, number[]> => {
  const history = new Map<Position, number[]>();

  for (const sale of sales) {
    addMapValue(history, sale.position, sale.priceDollars);
  }

  return history;
};

const createPositionInflationMultipliers = (
  baselinePrices: readonly PricingSourcePrice[],
  sales: readonly HistoricalSaleRecord[],
): ReadonlyMap<Position, number> => {
  const baselineAverages = positionAverages(baselinePrices);
  const positionHistory = createPositionHistory(sales);
  const multipliers = new Map<Position, number>();

  for (const [position, historicalPrices] of positionHistory) {
    const baselineAverage = baselineAverages.get(position);
    const historicalAverage = average(historicalPrices);
    if (
      baselineAverage === undefined
      || baselineAverage <= 0
      || historicalAverage === undefined
    ) {
      continue;
    }

    const historicalRatio = historicalAverage / baselineAverage;
    multipliers.set(position, 1 + (historicalRatio - 1) * HISTORICAL_BLEND_WEIGHT);
  }

  return multipliers;
};

const calibratedMarketPrice = (
  baselinePrice: PricingSourcePrice,
  playerHistory: ReadonlyMap<string, number[]>,
  positionInflationMultipliers: ReadonlyMap<Position, number>,
): CalibrationResult => {
  const baselineWholeDollars = clampWholeDollars(baselinePrice.price);
  const matchingPlayerPrices = playerHistory.get(
    playerHistoryKey(baselinePrice.normalizedName, baselinePrice.position),
  );
  const matchingPlayerAverage = matchingPlayerPrices === undefined
    ? undefined
    : average(matchingPlayerPrices);

  if (matchingPlayerAverage !== undefined) {
    const price = clampWholeDollars(
      baselineWholeDollars
        + (matchingPlayerAverage - baselineWholeDollars) * HISTORICAL_BLEND_WEIGHT,
    );

    return {
      price,
      historicalMove: price - baselineWholeDollars,
    };
  }

  const positionMultiplier = positionInflationMultipliers.get(baselinePrice.position);
  if (positionMultiplier !== undefined) {
    const price = clampWholeDollars(baselineWholeDollars * positionMultiplier);

    return {
      price,
      historicalMove: price - baselineWholeDollars,
    };
  }

  return {
    price: baselineWholeDollars,
    historicalMove: 0,
  };
};

const historicalMoveWarning = (historicalMove: number): string | undefined =>
  Math.abs(historicalMove) >= MATERIAL_HISTORICAL_MOVE_DOLLARS
    ? `historical inflation moved price by $${Math.abs(historicalMove)}`
    : undefined;

const sourcePriceForScenario = (
  sourcePrice: PricingSourcePrice,
  calibration: CalibrationResult,
  scenarioMultiplier: number,
): PricingSourcePrice => {
  const warning = historicalMoveWarning(calibration.historicalMove);

  return {
    name: sourcePrice.name,
    normalizedName: sourcePrice.normalizedName,
    position: sourcePrice.position,
    price: calibration.price,
    scenarioPrice: clampWholeDollars(calibration.price * scenarioMultiplier),
    warnings: warning === undefined
      ? [...(sourcePrice.warnings ?? [])]
      : [...(sourcePrice.warnings ?? []), warning],
    ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
    ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
  };
};

const historicalRecordHashInput = (record: HistoricalSaleRecord) => ({
  id: record.id,
  batchId: record.batchId,
  leagueId: record.leagueId,
  leagueSeasonId: record.leagueSeasonId,
  seasonYear: record.seasonYear,
  rowNumber: record.rowNumber,
  ownerId: record.ownerId,
  playerId: record.playerId,
  normalizedName: normalizePlayerName(record.playerName),
  position: record.position,
  priceDollars: record.priceDollars,
  keeper: record.keeper,
  acquisitionType: record.acquisitionType,
});

const historicalRecordSortKey = (record: HistoricalSaleRecord): string =>
  [
    record.leagueId,
    String(record.seasonYear),
    record.id,
    record.batchId,
    String(record.rowNumber),
    record.playerId,
    normalizePlayerName(record.playerName),
    record.position,
    String(record.priceDollars),
  ].join("\0");

const inputSnapshotPayload = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  scenarioIds: readonly string[],
  historicalSaleRecords: readonly HistoricalSaleRecord[],
) => ({
  service: "league-calibrated-pricing-rebuild",
  leagueId: input.leagueId,
  seasonYear: input.seasonYear,
  modelVersion: input.modelVersion,
  scenarioIds,
  baselinePrices: input.baselinePrices,
  historicalSaleRecords: [...historicalSaleRecords]
    .sort((left, right) => historicalRecordSortKey(left).localeCompare(historicalRecordSortKey(right)))
    .map(historicalRecordHashInput),
  currentAuctionBudget: input.currentAuctionBudget,
  currentTeamCount: input.currentTeamCount,
  keeperLockedSpend: input.keeperLockedSpend,
});

export const createLeagueCalibratedPricingSnapshots = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly PricingSnapshot[] => {
  const scenarioIds = normalizedScenarioIds(input.scenarioIds);
  const recentSales = recentAuctionSales(input.historicalSaleRecords, input.leagueId, input.seasonYear);
  const playerHistory = createPlayerHistory(recentSales);
  const positionInflationMultipliers = createPositionInflationMultipliers(
    input.baselinePrices,
    recentSales,
  );
  const calibratedPrices = input.baselinePrices.map(price =>
    [price, calibratedMarketPrice(price, playerHistory, positionInflationMultipliers)] as const,
  );
  const inputSnapshot = createPricingInputSnapshot(inputSnapshotPayload(input, scenarioIds, recentSales));

  return scenarioIds.map(scenarioId => createPricingSnapshot({
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    scenarioId,
    inputSnapshot,
    prices: calibratedPrices.map(([price, calibration]) =>
      sourcePriceForScenario(price, calibration, scenarioMultiplierFor(scenarioId)),
    ),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  }));
};
