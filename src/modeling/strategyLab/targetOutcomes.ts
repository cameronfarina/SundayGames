import type { Owner } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { MockResultsRun } from "../mockResults.js";
import { average, roundToTwo } from "./math.js";
import type { StrategyLabTargetOutcome } from "./reportContracts.js";
import type { StrategyLabTargetMaxBid } from "./scenarioContracts.js";

interface RosteredTarget {
  owner: Owner;
  price: number;
}

const rosteredTargetFor = (
  run: MockResultsRun,
  playerName: string,
): RosteredTarget | undefined => {
  const normalizedName = normalizePlayerName(playerName);

  for (const team of run.teams) {
    const player = team.players.find(
      candidate => normalizePlayerName(candidate.name) === normalizedName,
    );
    if (player) return { owner: team.owner, price: player.price };
  }
  return undefined;
};

const outcomeFor = (
  target: StrategyLabTargetMaxBid,
  mockRuns: readonly MockResultsRun[],
): StrategyLabTargetOutcome => {
  const rosteredTargets: RosteredTarget[] = [];
  for (const run of mockRuns) {
    const rosteredTarget = rosteredTargetFor(run, target.player);
    if (rosteredTarget) rosteredTargets.push(rosteredTarget);
  }

  const salePrices = rosteredTargets.map(result => result.price);
  const draftedByCamCount = rosteredTargets.filter(
    result => result.owner === target.owner,
  ).length;

  return {
    owner: target.owner,
    player: target.player,
    maxBid: target.maxBid,
    runCount: mockRuns.length,
    draftedByCamCount,
    draftedByCamRate: roundToTwo(draftedByCamCount / Math.max(1, mockRuns.length)),
    draftedByOtherCount: rosteredTargets.filter(result => result.owner !== target.owner).length,
    missedCount: mockRuns.length - draftedByCamCount,
    averageSalePrice: roundToTwo(average(salePrices)),
    minimumSalePrice: salePrices.length === 0 ? 0 : Math.min(...salePrices),
    maximumSalePrice: salePrices.length === 0 ? 0 : Math.max(...salePrices),
  };
};

export const targetOutcomesFor = (
  targetMaxBids: readonly StrategyLabTargetMaxBid[],
  mockRuns: readonly MockResultsRun[],
): StrategyLabTargetOutcome[] =>
  targetMaxBids.map(target => outcomeFor(target, mockRuns));
