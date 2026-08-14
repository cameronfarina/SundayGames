import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import type { MockBatch, MockRun } from "../mockBatch.js";
import type {
  PlayerAuditMockPick,
  PlayerAuditMockSale,
} from "./contracts/mockSale.js";
import { average, roundToTwo } from "./math.js";

export const mockPicksFor = (
  batch: MockBatch,
  basePrice: BasePrice,
): PlayerAuditMockPick[] =>
  batch.runs.flatMap(run =>
    run.picks
      .filter(pick => normalizePlayerName(pick.player) === basePrice.normalizedName)
      .map(pick => ({
        seed: run.seed,
        pick: pick.pick,
        nominator: pick.nominator,
        owner: pick.owner,
        salePrice: pick.price,
        marketPrice: pick.marketPrice,
        budgetAfterPick: pick.budgetAfterPick,
        rosterSlotsAfterPick: pick.rosterSlotsAfterPick,
      })),
  );

export const mockSaleFor = (
  runs: readonly MockRun[],
  picks: readonly PlayerAuditMockPick[],
  scenarioPrice: number,
): PlayerAuditMockSale => {
  const salePrices = picks.map(pick => pick.salePrice);
  const marketPrices = picks.map(pick => pick.marketPrice);
  const averageSalePrice = salePrices.length > 0
    ? roundToTwo(average(salePrices))
    : null;

  return {
    runCount: runs.length,
    draftedCount: picks.length,
    draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
    averageMarketPrice: marketPrices.length > 0
      ? roundToTwo(average(marketPrices))
      : null,
    averageSalePrice,
    averageSaleVsScenarioPrice: averageSalePrice === null
      ? null
      : roundToTwo(averageSalePrice - scenarioPrice),
    minSalePrice: salePrices.length > 0 ? Math.min(...salePrices) : null,
    maxSalePrice: salePrices.length > 0 ? Math.max(...salePrices) : null,
    picks,
  };
};
