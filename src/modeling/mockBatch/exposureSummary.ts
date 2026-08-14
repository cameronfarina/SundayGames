import type { Owner, Position } from "../../../config/league.js";
import type { MockRun, OwnerPlayerExposureSummary } from "./contracts.js";
import { average, roundToTwo } from "./math.js";

interface ExposureEntry {
  owner: Owner;
  player: string;
  position: Position;
  prices: number[];
}

export const summarizeOwnerPlayerExposure = (
  runs: readonly MockRun[],
): OwnerPlayerExposureSummary[] => {
  const exposure = new Map<string, ExposureEntry>();

  for (const run of runs) {
    for (const roster of run.rosters) {
      for (const player of roster.players) {
        const key = `${roster.owner}|${player.name}`;
        const entry = exposure.get(key) ?? {
          owner: roster.owner,
          player: player.name,
          position: player.position,
          prices: [],
        };
        entry.prices.push(player.price);
        exposure.set(key, entry);
      }
    }
  }

  return [...exposure.values()]
    .map(entry => ({
      owner: entry.owner,
      player: entry.player,
      position: entry.position,
      draftedCount: entry.prices.length,
      draftedRate: roundToTwo(entry.prices.length / Math.max(1, runs.length)),
      averagePrice: roundToTwo(average(entry.prices)),
    }))
    .sort(
      (left, right) =>
        right.draftedCount - left.draftedCount ||
        right.averagePrice - left.averagePrice ||
        left.owner.localeCompare(right.owner) ||
        left.player.localeCompare(right.player),
    );
};
