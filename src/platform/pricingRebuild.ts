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
  currentRosterSize?: number;
  currentMinimumBidDollars?: number;
  currentKeeperCount?: number;
  keeperLockedSpend?: number;
  createdAt?: string;
}

interface CalibrationResult {
  price: number;
  historicalMove: number;
}

interface PositionInflationResult {
  multipliers: ReadonlyMap<Position, number>;
  publicValueCoverage: ReadonlyMap<Position, number>;
  matchedSaleCount: number;
}

interface PositionSaleCurveResult {
  pricesByPosition: ReadonlyMap<Position, readonly number[]>;
}

interface LeagueAuctionAllocation {
  scenarioPrices: readonly number[];
  warnings: readonly string[];
}

interface WholeDollarAllocation {
  allocations: readonly number[];
  unallocatedDollars: number;
}

const BALANCED_SCENARIO_ID = "balanced";
const HISTORICAL_BLEND_WEIGHT = 0.5;
const MATERIAL_HISTORICAL_MOVE_DOLLARS = 5;
const RECENT_SEASON_COUNT = 3;
const MINIMUM_HISTORICAL_RATIO = 0.5;
const MAXIMUM_HISTORICAL_RATIO = 2;
const HISTORY_UNAVAILABLE_WARNING =
  "league auction history unavailable; using baseline market prices";
const HISTORY_SALE_CURVE_WARNING =
  "same-season public auction values unavailable; calibrated from league sale-price curves";
const AUCTION_CONTEXT_UNAVAILABLE_WARNING =
  "league auction allocation unavailable; team count, budget, roster size, minimum bid, and keeper count were not fully provided";
const SCENARIO_ASSUMPTIONS_UNAVAILABLE_WARNING =
  "scenario-specific assumptions unavailable; using the league-calibrated value";

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

const clampWholeDollars = (value: number, maximum = Number.POSITIVE_INFINITY): number => {
  if (!Number.isFinite(value)) return 0;

  return Math.min(maximum, Math.max(0, Math.round(value)));
};

const average = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined;

  return values.reduce((total, value) => total + value, 0) / values.length;
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

const createPlayerHistory = (
  sales: readonly HistoricalSaleRecord[],
): ReadonlyMap<string, number[]> => {
  const history = new Map<string, number[]>();

  for (const sale of sales) {
    if (sale.publicPriceDollars === undefined || sale.publicPriceDollars <= 0) continue;
    const boundedRatio = Math.min(
      MAXIMUM_HISTORICAL_RATIO,
      Math.max(MINIMUM_HISTORICAL_RATIO, sale.priceDollars / sale.publicPriceDollars),
    );
    addMapValue(history, playerHistoryKey(sale.playerName, sale.position), boundedRatio);
  }

  return history;
};

const createPositionInflationMultipliers = (
  sales: readonly HistoricalSaleRecord[],
): PositionInflationResult => {
  const ratiosByPosition = new Map<Position, number[]>();
  const saleCountByPosition = new Map<Position, number>();
  const multipliers = new Map<Position, number>();
  const publicValueCoverage = new Map<Position, number>();
  let matchedSaleCount = 0;

  for (const sale of sales) {
    saleCountByPosition.set(sale.position, (saleCountByPosition.get(sale.position) ?? 0) + 1);
    if (sale.publicPriceDollars === undefined || sale.publicPriceDollars <= 0) continue;

    const boundedRatio = Math.min(
      MAXIMUM_HISTORICAL_RATIO,
      Math.max(MINIMUM_HISTORICAL_RATIO, sale.priceDollars / sale.publicPriceDollars),
    );
    addMapValue(ratiosByPosition, sale.position, boundedRatio);
    matchedSaleCount += 1;
  }

  for (const [position, ratios] of ratiosByPosition) {
    const historicalRatio = average(ratios);
    if (historicalRatio !== undefined) {
      multipliers.set(position, 1 + (historicalRatio - 1) * HISTORICAL_BLEND_WEIGHT);
      publicValueCoverage.set(
        position,
        ratios.length / (saleCountByPosition.get(position) ?? ratios.length),
      );
    }
  }

  return { multipliers, publicValueCoverage, matchedSaleCount };
};

const createPositionSaleCurves = (
  sales: readonly HistoricalSaleRecord[],
): PositionSaleCurveResult => {
  const seasonPricesByPosition = new Map<Position, Map<number, number[]>>();
  const pricesByPosition = new Map<Position, readonly number[]>();

  for (const sale of sales) {
    const seasonPrices = seasonPricesByPosition.get(sale.position) ?? new Map<number, number[]>();
    addMapValue(seasonPrices, sale.seasonYear, sale.priceDollars);
    seasonPricesByPosition.set(sale.position, seasonPrices);
  }

  for (const [position, seasonPrices] of seasonPricesByPosition) {
    const seasonCurves = [...seasonPrices.values()]
      .map(prices => prices.sort((left, right) => right - left));
    const maximumRankCount = Math.max(0, ...seasonCurves.map(prices => prices.length));
    const rankPrices = Array.from({ length: maximumRankCount }, (_, rankIndex) =>
      average(seasonCurves.flatMap(prices => {
        const price = prices[rankIndex];
        return price === undefined ? [] : [price];
      })) ?? 0
    );
    pricesByPosition.set(position, rankPrices);
  }

  return { pricesByPosition };
};

const historicalRankPricesForBaselines = (
  baselinePrices: readonly PricingSourcePrice[],
  saleCurves: PositionSaleCurveResult,
): ReadonlyMap<number, number> => {
  const historicalPriceByIndex = new Map<number, number>();

  for (const position of new Set(baselinePrices.map(price => price.position))) {
    const historicalPrices = saleCurves.pricesByPosition.get(position) ?? [];
    baselinePrices
      .map((price, index) => ({ price, index }))
      .filter(candidate => candidate.price.position === position)
      .sort((left, right) =>
        right.price.price - left.price.price
          || left.price.normalizedName.localeCompare(right.price.normalizedName)
      )
      .forEach(({ index }, rankIndex) => {
        const historicalPrice = historicalPrices[rankIndex];
        if (historicalPrice !== undefined) historicalPriceByIndex.set(index, historicalPrice);
      });
  }

  return historicalPriceByIndex;
};

const calibratedMarketPrice = (
  baselinePrice: PricingSourcePrice,
  playerHistory: ReadonlyMap<string, number[]>,
  positionInflationMultipliers: ReadonlyMap<Position, number>,
  positionPublicValueCoverage: ReadonlyMap<Position, number>,
  historicalRankPrice: number | undefined,
  maximumPrice: number,
): CalibrationResult => {
  const baselineWholeDollars = clampWholeDollars(baselinePrice.price, maximumPrice);
  const matchingPlayerRatios = playerHistory.get(
    playerHistoryKey(baselinePrice.normalizedName, baselinePrice.position),
  );
  const matchingPlayerAverageRatio = matchingPlayerRatios === undefined
    ? undefined
    : average(matchingPlayerRatios);

  if (matchingPlayerAverageRatio !== undefined) {
    const boundedHistoricalAverage = baselineWholeDollars * matchingPlayerAverageRatio;
    const price = clampWholeDollars(
      baselineWholeDollars
        + (boundedHistoricalAverage - baselineWholeDollars) * HISTORICAL_BLEND_WEIGHT,
      maximumPrice,
    );

    return {
      price,
      historicalMove: price - baselineWholeDollars,
    };
  }

  const positionMultiplier = positionInflationMultipliers.get(baselinePrice.position);
  if (positionMultiplier !== undefined && historicalRankPrice !== undefined) {
    const positionPrice = baselineWholeDollars * positionMultiplier;
    const curvePrice = baselineWholeDollars
      + (historicalRankPrice - baselineWholeDollars) * HISTORICAL_BLEND_WEIGHT;
    const publicValueCoverage = positionPublicValueCoverage.get(baselinePrice.position) ?? 0;
    const price = clampWholeDollars(
      curvePrice + (positionPrice - curvePrice) * publicValueCoverage,
      maximumPrice,
    );

    return {
      price,
      historicalMove: price - baselineWholeDollars,
    };
  }

  if (positionMultiplier !== undefined) {
    const price = clampWholeDollars(baselineWholeDollars * positionMultiplier, maximumPrice);

    return {
      price,
      historicalMove: price - baselineWholeDollars,
    };
  }

  if (historicalRankPrice !== undefined) {
    const price = clampWholeDollars(
      baselineWholeDollars
        + (historicalRankPrice - baselineWholeDollars) * HISTORICAL_BLEND_WEIGHT,
      maximumPrice,
    );

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
    ? `league history moved price ${historicalMove > 0 ? "up" : "down"} by $${Math.abs(historicalMove)}`
    : undefined;

const historyWarningsFor = (
  recentSaleCount: number,
  publicValueSaleCount: number,
): readonly string[] => {
  if (recentSaleCount === 0) return [HISTORY_UNAVAILABLE_WARNING];
  if (publicValueSaleCount === 0) return [HISTORY_SALE_CURVE_WARNING];
  if (publicValueSaleCount === recentSaleCount) return [];

  return [
    `${recentSaleCount - publicValueSaleCount} historical sale(s) lacked same-season public dollar values; league sale-price curves were used where public anchors were unavailable`,
  ];
};

const sourcePriceForScenario = (
  sourcePrice: PricingSourcePrice,
  calibration: CalibrationResult,
  scenarioPrice: number,
  sharedWarnings: readonly string[],
): PricingSourcePrice => {
  const warning = historicalMoveWarning(calibration.historicalMove);
  const warnings = [
    ...(sourcePrice.warnings ?? []),
    ...sharedWarnings,
    ...(warning === undefined ? [] : [warning]),
  ];

  return {
    name: sourcePrice.name,
    normalizedName: sourcePrice.normalizedName,
    position: sourcePrice.position,
    price: calibration.price,
    scenarioPrice,
    warnings: [...new Set(warnings)],
    ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
    ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
  };
};

const isPositiveInteger = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 0;

const allocationWeights = (
  selectedIndexes: readonly number[],
  calibratedPrices: readonly CalibrationResult[],
  minimumBidDollars: number,
): readonly number[] => selectedIndexes.map(index =>
  Math.max(0, (calibratedPrices[index]?.price ?? 0) - minimumBidDollars),
);

const allocateWholeDollars = (
  weights: readonly number[],
  dollars: number,
  maximumPerPlayer: number,
): WholeDollarAllocation => {
  const allocations = weights.map(() => 0);
  let remainingDollars = dollars;
  let activeIndexes = weights.map((_, index) => index);

  while (remainingDollars > 0 && activeIndexes.length > 0) {
    const weightTotal = activeIndexes.reduce((total, index) => total + (weights[index] ?? 0), 0);
    const denominator = weightTotal > 0 ? weightTotal : activeIndexes.length;
    const quotas = activeIndexes.map(index => ({
      index,
      quota: remainingDollars * (weightTotal > 0 ? (weights[index] ?? 0) : 1) / denominator,
    }));
    const capped = quotas.filter(({ index, quota }) =>
      quota >= maximumPerPlayer - (allocations[index] ?? 0),
    );

    if (capped.length > 0) {
      const cappedIndexes = new Set(capped.map(({ index }) => index));
      for (const { index } of capped) {
        const capacity = maximumPerPlayer - (allocations[index] ?? 0);
        allocations[index] = maximumPerPlayer;
        remainingDollars -= capacity;
      }
      activeIndexes = activeIndexes.filter(index => !cappedIndexes.has(index));
      continue;
    }

    let allocatedThisPass = 0;
    for (const { index, quota } of quotas) {
      const wholeDollars = Math.floor(quota);
      allocations[index] = (allocations[index] ?? 0) + wholeDollars;
      allocatedThisPass += wholeDollars;
    }
    remainingDollars -= allocatedThisPass;

    const remainderOrder = quotas
      .map(({ index, quota }) => ({ index, remainder: quota - Math.floor(quota) }))
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
    for (const { index } of remainderOrder) {
      if (remainingDollars <= 0) break;
      if ((allocations[index] ?? 0) >= maximumPerPlayer) continue;
      allocations[index] = (allocations[index] ?? 0) + 1;
      remainingDollars -= 1;
    }
  }

  return { allocations, unallocatedDollars: remainingDollars };
};

const leagueAuctionAllocation = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  calibratedPrices: readonly CalibrationResult[],
): LeagueAuctionAllocation => {
  const keeperLockedSpend = input.keeperLockedSpend ?? 0;
  const keeperCount = input.currentKeeperCount ?? (keeperLockedSpend === 0 ? 0 : undefined);
  if (
    !isPositiveInteger(input.currentTeamCount)
    || !isPositiveInteger(input.currentAuctionBudget)
    || !isPositiveInteger(input.currentRosterSize)
    || !isPositiveInteger(input.currentMinimumBidDollars)
    || input.currentMinimumBidDollars > input.currentAuctionBudget
    || !isNonNegativeInteger(keeperCount)
    || !isNonNegativeInteger(keeperLockedSpend)
  ) {
    return {
      scenarioPrices: calibratedPrices.map(calibration => calibration.price),
      warnings: [AUCTION_CONTEXT_UNAVAILABLE_WARNING],
    };
  }

  const totalRosterSlots = input.currentTeamCount * input.currentRosterSize;
  if (keeperCount > totalRosterSlots) {
    return {
      scenarioPrices: calibratedPrices.map(calibration => calibration.price),
      warnings: ["league auction allocation unavailable; keeper count exceeds roster capacity"],
    };
  }

  const openRosterSlots = totalRosterSlots - keeperCount;
  if (calibratedPrices.length < openRosterSlots) {
    return {
      scenarioPrices: calibratedPrices.map(calibration => calibration.price),
      warnings: [
        `league auction allocation unavailable; ${calibratedPrices.length} players cannot fill ${openRosterSlots} open roster slots`,
      ],
    };
  }

  const totalLeagueBudget = input.currentTeamCount * input.currentAuctionBudget;
  const availableDollars = clampWholeDollars(totalLeagueBudget - keeperLockedSpend, totalLeagueBudget);
  const minimumBidReserve = openRosterSlots * input.currentMinimumBidDollars;
  if (availableDollars < minimumBidReserve) {
    return {
      scenarioPrices: calibratedPrices.map(calibration => calibration.price),
      warnings: [
        `league auction allocation unavailable; $${availableDollars} remaining cannot cover the $${minimumBidReserve} minimum-bid reserve`,
      ],
    };
  }

  const selectedIndexes = calibratedPrices
    .map((calibration, index) => ({ index, price: calibration.price }))
    .sort((left, right) => right.price - left.price || left.index - right.index)
    .slice(0, openRosterSlots)
    .map(({ index }) => index);
  const discretionaryDollars = availableDollars - minimumBidReserve;
  const maximumDiscretionaryPerPlayer = input.currentAuctionBudget - input.currentMinimumBidDollars;
  const discretionaryAllocation = allocateWholeDollars(
    allocationWeights(selectedIndexes, calibratedPrices, input.currentMinimumBidDollars),
    discretionaryDollars,
    maximumDiscretionaryPerPlayer,
  );
  const scenarioPrices = calibratedPrices.map(() => 0);
  for (let selectionIndex = 0; selectionIndex < selectedIndexes.length; selectionIndex += 1) {
    const playerIndex = selectedIndexes[selectionIndex];
    if (playerIndex !== undefined) {
      scenarioPrices[playerIndex] = input.currentMinimumBidDollars
        + (discretionaryAllocation.allocations[selectionIndex] ?? 0);
    }
  }

  return {
    scenarioPrices,
    warnings: [
      ...(keeperCount > 0
        ? [
          "keeper identities unavailable; auction allocation assumes the baseline catalog contains only available players",
          "keeper team distribution unavailable; keeper spend is calibrated at league-pool level",
        ]
        : []),
      ...(discretionaryAllocation.unallocatedDollars > 0
        ? [
          `$${discretionaryAllocation.unallocatedDollars} could not be allocated within per-player budget limits`,
        ]
        : []),
    ],
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
  publicPriceDollars: record.publicPriceDollars,
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
  historicalSaleRecords: readonly HistoricalSaleRecord[],
) => ({
  service: "league-calibrated-pricing-rebuild",
  leagueId: input.leagueId,
  seasonYear: input.seasonYear,
  modelVersion: input.modelVersion,
  baselinePrices: input.baselinePrices,
  historicalSaleRecords: [...historicalSaleRecords]
    .sort((left, right) => historicalRecordSortKey(left).localeCompare(historicalRecordSortKey(right)))
    .map(historicalRecordHashInput),
  currentAuctionBudget: input.currentAuctionBudget,
  currentTeamCount: input.currentTeamCount,
  currentRosterSize: input.currentRosterSize,
  currentMinimumBidDollars: input.currentMinimumBidDollars,
  currentKeeperCount: input.currentKeeperCount,
  keeperLockedSpend: input.keeperLockedSpend,
});

export const createLeagueCalibratedPricingSnapshots = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly PricingSnapshot[] => {
  const scenarioIds = normalizedScenarioIds(input.scenarioIds);
  const recentSales = recentAuctionSales(input.historicalSaleRecords, input.leagueId, input.seasonYear);
  const playerHistory = createPlayerHistory(recentSales);
  const positionInflation = createPositionInflationMultipliers(
    recentSales,
  );
  const positionSaleCurves = createPositionSaleCurves(recentSales);
  const historicalRankPrices = historicalRankPricesForBaselines(
    input.baselinePrices,
    positionSaleCurves,
  );
  const maximumPrice = isPositiveInteger(input.currentAuctionBudget)
    ? input.currentAuctionBudget
    : Number.POSITIVE_INFINITY;
  const calibratedPrices = input.baselinePrices.map((price, index) =>
    calibratedMarketPrice(
      price,
      playerHistory,
      positionInflation.multipliers,
      positionInflation.publicValueCoverage,
      historicalRankPrices.get(index),
      maximumPrice,
    ),
  );
  const auctionAllocation = leagueAuctionAllocation(input, calibratedPrices);
  const historyWarnings = historyWarningsFor(
    recentSales.length,
    positionInflation.matchedSaleCount,
  );
  const inputSnapshot = createPricingInputSnapshot(inputSnapshotPayload(input, recentSales));

  return scenarioIds.map(scenarioId => createPricingSnapshot({
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    scenarioId,
    inputSnapshot,
    prices: input.baselinePrices.map((price, index) =>
      sourcePriceForScenario(
        price,
        calibratedPrices[index] ?? { price: 0, historicalMove: 0 },
        auctionAllocation.scenarioPrices[index] ?? 0,
        [
          ...historyWarnings,
          ...auctionAllocation.warnings,
          ...(scenarioId === BALANCED_SCENARIO_ID ? [] : [SCENARIO_ASSUMPTIONS_UNAVAILABLE_WARNING]),
        ],
      ),
    ),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  }));
};
