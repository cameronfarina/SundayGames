import {
  createPricingInputSnapshot,
  createPricingSnapshot,
  type PricingSnapshot,
} from "../pricingSnapshots.js";
import {
  balancedScenarioId,
  scenarioAssumptionsUnavailableWarning,
} from "./constants.js";
import type { CreateLeagueCalibratedPricingSnapshotsInput } from "./contracts.js";
import { isPositiveInteger, normalizedScenarioIds } from "./helpers.js";
import { countedInflationSales, leagueInflationFor } from "./leagueInflation.js";
import {
  inflationWarningsFor,
  leaguePriceFor,
  sourcePriceForScenario,
} from "./leaguePricing.js";
import { inputSnapshotPayload } from "./snapshotPayload.js";

export const createLeagueCalibratedPricingSnapshots = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly PricingSnapshot[] => {
  const scenarioIds = normalizedScenarioIds(input.scenarioIds);
  const inflation = leagueInflationFor(input);
  const maximumPrice = isPositiveInteger(input.currentAuctionBudget)
    ? input.currentAuctionBudget
    : Number.POSITIVE_INFINITY;
  const leaguePrices = input.baselinePrices.map(price =>
    leaguePriceFor(price, inflation.multiplier, maximumPrice));
  const inflationWarnings = inflationWarningsFor(inflation);
  const inputSnapshot = createPricingInputSnapshot(
    inputSnapshotPayload(input, countedInflationSales(input)),
  );
  return scenarioIds.map(scenarioId => createPricingSnapshot({
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    scenarioId,
    inputSnapshot,
    prices: input.baselinePrices.map((price, index) => sourcePriceForScenario(
      price,
      leaguePrices[index] ?? price.price,
      [
        ...inflationWarnings,
        ...(scenarioId === balancedScenarioId
          ? []
          : [scenarioAssumptionsUnavailableWarning]),
      ],
    )),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  }));
};
