import {
  createPricingInputSnapshot,
  createPricingSnapshot,
  type PricingSnapshot,
} from "../pricingSnapshots.js";
import {
  balancedScenarioId,
  scenarioAssumptionsUnavailableWarning,
  slotFloorWarning,
} from "./constants.js";
import type { CreateLeagueCalibratedPricingSnapshotsInput } from "./contracts.js";
import { isPositiveInteger, normalizedScenarioIds } from "./helpers.js";
import { countedInflationSales, leagueInflationFor } from "./leagueInflation.js";
import {
  inflationWarningsFor,
  leaguePriceFor,
  sourcePriceForScenario,
} from "./leaguePricing.js";
import { slotFloorByBaselineIndex, slotFloorRecords } from "./slotPriceFloors.js";
import { inputSnapshotPayload } from "./snapshotPayload.js";

export const createLeagueCalibratedPricingSnapshots = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly PricingSnapshot[] => {
  const scenarioIds = normalizedScenarioIds(input.scenarioIds);
  const inflation = leagueInflationFor(input);
  const floorRecords = slotFloorRecords(input);
  const floors = slotFloorByBaselineIndex(input.baselinePrices, floorRecords);
  const maximumPrice = isPositiveInteger(input.currentAuctionBudget)
    ? input.currentAuctionBudget
    : Number.POSITIVE_INFINITY;
  const leaguePrices = input.baselinePrices.map((price, index) =>
    leaguePriceFor(price, inflation.multiplier, maximumPrice, floors.get(index) ?? 0));
  const inflationWarnings = [
    ...inflationWarningsFor(inflation),
    ...(floors.size > 0 ? [slotFloorWarning] : []),
  ];
  // Floor-only slot records move prices without moving the inflation number,
  // so they belong in the input identity too or a price change keeps a stale
  // snapshot alive.
  const hashedRecords = [...new Map(
    [...countedInflationSales(input), ...floorRecords]
      .map(record => [record.id, record]),
  ).values()];
  const inputSnapshot = createPricingInputSnapshot(
    inputSnapshotPayload(input, hashedRecords),
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
