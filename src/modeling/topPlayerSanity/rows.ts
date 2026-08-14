import type { ScenarioAdjustedPrice } from "../keeperInflation.js";
import type { MockRun } from "../mockBatch.js";
import type { TopPlayerSanityRow } from "./contracts.js";
import { flagsFor } from "./flags.js";
import { saleSummaryFor } from "./sales.js";

export const rowsFor = (
  prices: readonly ScenarioAdjustedPrice[],
  runs: readonly MockRun[],
  limit: number,
): TopPlayerSanityRow[] => prices.slice(0, limit).map((player, index) => {
  const sale = saleSummaryFor(runs, player);
  return {
    rank: index + 1,
    name: player.name,
    position: player.position,
    publicAnchorValue: player.publicAnchorValue,
    projectionRank: player.projectionRank,
    espnRank: player.espnRank ?? null,
    rankGap: player.rankGap ?? null,
    basePrice: player.price,
    scenarioPrice: player.scenarioPrice,
    draftedCount: sale.draftedCount,
    draftedRate: sale.draftedRate,
    averageMockSalePrice: sale.averageSalePrice,
    saleVsScenarioPrice: sale.saleVsScenarioPrice,
    minMockSalePrice: sale.minSalePrice,
    maxMockSalePrice: sale.maxSalePrice,
    contextAdjustmentPercent: player.contextAdjustmentPercent,
    contextEvidenceCount: player.contextEvidence?.length ?? 0,
    ...(player.contextEvidence ? { contextEvidence: player.contextEvidence } : {}),
    flags: flagsFor(player, sale),
  };
});
