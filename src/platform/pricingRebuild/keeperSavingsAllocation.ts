import type {
  CalibrationResult,
  CreateLeagueCalibratedPricingSnapshotsInput,
  LeagueAuctionAllocation,
} from "./contracts.js";
import { baselineAllocation, fullBudgetAllocation } from "./fullBudgetAllocation.js";

const publicBaselineCalibrations = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly CalibrationResult[] => input.baselinePrices.map(price => ({
  price: price.price,
  historicalMove: 0,
}));

const keeperSavingsWarnings = (keeperSavings: number): readonly string[] => {
  if (keeperSavings > 0) {
    return [`available player values include $${keeperSavings} in public-market keeper savings at the full-pool rate`];
  }
  if (keeperSavings < 0) {
    return [`available player values include a $${Math.abs(keeperSavings)} public-market keeper deficit at the full-pool rate`];
  }
  return [];
};

const proportionalAdjustment = (
  price: number,
  fullPoolWeight: number,
  adjustmentDollars: number,
): number => fullPoolWeight === 0
  ? 0
  : Math.floor((Math.max(0, price - 1) * Math.abs(adjustmentDollars)) / fullPoolWeight);

const pricesWithKeeperSavings = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  baselinePrices: readonly number[],
  calibratedPrices: readonly CalibrationResult[],
  keeperIndexSet: ReadonlySet<number>,
  keeperSavings: number,
): readonly number[] => {
  const prices = [...baselinePrices];
  keeperIndexSet.forEach(index => {
    prices[index] = calibratedPrices[index]?.price ?? 0;
  });
  const availableIndexes = prices
    .map((price, index) => ({ index, price }))
    .filter(({ index, price }) => price > 0 && !keeperIndexSet.has(index))
    .map(({ index }) => index);
  const adjustmentDollars = keeperSavings >= 0
    ? keeperSavings
    : -Math.min(
        Math.abs(keeperSavings),
        availableIndexes.reduce(
          (total, index) => total + Math.max(0, (prices[index] ?? 0) - 1),
          0,
        ),
      );
  const fullPoolWeight = prices.reduce(
    (total, price) => total + Math.max(0, price - 1),
    0,
  );
  const maximumPlayerPrice = input.currentAuctionBudget ?? Number.MAX_SAFE_INTEGER;
  availableIndexes.forEach(index => {
    const adjustment = proportionalAdjustment(
      prices[index] ?? 0,
      fullPoolWeight,
      adjustmentDollars,
    );
    prices[index] = adjustmentDollars >= 0
      ? Math.min(maximumPlayerPrice, (prices[index] ?? 0) + adjustment)
      : Math.max(1, (prices[index] ?? 0) - adjustment);
  });
  return prices;
};

export const keeperSavingsAllocation = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  calibratedPrices: readonly CalibrationResult[],
  hasLeagueHistory: boolean,
): LeagueAuctionAllocation => {
  const keepers = input.currentKeepers ?? [];
  const keeperIndexes = new Map<string, number>();
  input.baselinePrices.forEach((price, index) => keeperIndexes.set(price.normalizedName, index));
  const resolvedKeepers = keepers.flatMap(keeper => {
    const index = keeperIndexes.get(keeper.normalizedName);
    return index === undefined ? [] : [{ ...keeper, index }];
  });
  if (resolvedKeepers.length !== keepers.length) {
    return baselineAllocation(
      calibratedPrices,
      "league auction allocation unavailable; a keeper was missing from the baseline catalog",
    );
  }

  const leagueBudgetBaseline = fullBudgetAllocation(
    input,
    publicBaselineCalibrations(input),
    0,
    0,
  );
  const keeperIndexSet = new Set(resolvedKeepers.map(keeper => keeper.index));
  const keeperSavings = resolvedKeepers.reduce(
    (total, keeper) => total + (input.baselinePrices[keeper.index]?.price ?? 0) - keeper.priceDollars,
    0,
  );
  // History-calibrated prices stay on the public baseline's scale, so they
  // must pass through budget allocation before they can price this league.
  const historicalBudgetBaseline = hasLeagueHistory
    ? fullBudgetAllocation(input, calibratedPrices, 0, 0)
    : undefined;
  const scenarioBaseline = historicalBudgetBaseline === undefined
    ? leagueBudgetBaseline.scenarioPrices
    : historicalBudgetBaseline.scenarioPrices;
  const personalBaseline = historicalBudgetBaseline === undefined
    ? leagueBudgetBaseline.scenarioPrices
    : historicalBudgetBaseline.scenarioPrices.map((price, index) =>
      Math.max(price, leagueBudgetBaseline.scenarioPrices[index] ?? 0));
  return {
    scenarioPrices: pricesWithKeeperSavings(
      input,
      scenarioBaseline,
      calibratedPrices,
      keeperIndexSet,
      keeperSavings,
    ),
    personalValues: pricesWithKeeperSavings(
      input,
      personalBaseline,
      calibratedPrices,
      keeperIndexSet,
      keeperSavings,
    ),
    warnings: [...new Set([
      ...leagueBudgetBaseline.warnings,
      ...(historicalBudgetBaseline?.warnings ?? []),
      ...keeperSavingsWarnings(keeperSavings),
    ])],
  };
};
