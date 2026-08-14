import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ScenarioAdjustedPrice } from "../keeperInflation.js";
import type { MockRun } from "../mockBatch.js";
import type { MockSaleSummary } from "./contracts.js";
import { average, roundToTwo } from "./math.js";

export const saleSummaryFor = (
  runs: readonly MockRun[],
  player: ScenarioAdjustedPrice,
): MockSaleSummary => {
  const picks = runs.flatMap(run =>
    run.picks.filter(pick => normalizePlayerName(pick.player) === player.normalizedName));
  const salePrices = picks.map(pick => pick.price);
  const averageSalePrice = roundToTwo(average(salePrices));
  return {
    draftedCount: picks.length,
    draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
    averageSalePrice,
    saleVsScenarioPrice: roundToTwo(averageSalePrice - player.scenarioPrice),
    minSalePrice: salePrices.length > 0 ? Math.min(...salePrices) : 0,
    maxSalePrice: salePrices.length > 0 ? Math.max(...salePrices) : 0,
  };
};
