import type { AuctionPick } from "../auctionEngine.js";
import type { MockRun, PlayerBatchSummary } from "./contracts.js";
import { average, roundToTwo } from "./math.js";

export const summarizePlayers = (runs: readonly MockRun[]): PlayerBatchSummary[] => {
  const picksByPlayer = new Map<string, AuctionPick[]>();
  for (const run of runs) {
    for (const pick of run.picks) {
      picksByPlayer.set(pick.player, [...(picksByPlayer.get(pick.player) ?? []), pick]);
    }
  }

  return [...picksByPlayer.entries()]
    .map(([name, picks]) => {
      const salePrices = picks.map(pick => pick.price);
      const firstPick = picks[0];
      if (!firstPick) throw new Error(`Missing picks for ${name}.`);
      return {
        name,
        position: firstPick.position,
        draftedCount: picks.length,
        draftedRate: roundToTwo(picks.length / Math.max(1, runs.length)),
        averageMarketPrice: roundToTwo(average(picks.map(pick => pick.marketPrice))),
        averageSalePrice: roundToTwo(average(salePrices)),
        minimumSalePrice: Math.min(...salePrices),
        maximumSalePrice: Math.max(...salePrices),
      };
    })
    .sort(
      (left, right) =>
        right.draftedCount - left.draftedCount ||
        right.averageSalePrice - left.averageSalePrice ||
        left.name.localeCompare(right.name),
    );
};
