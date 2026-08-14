import type { MockDraftScriptTargetMaxBid } from "../mockScript.js";
import type { MockResultsRun } from "./reportContracts.js";
import type { MockResultsScriptTargetOutcome } from "./scriptContracts.js";
import { average, roundToTwo } from "./formatting.js";
import { isRosteredTarget, rosteredTargetFor } from "./targetLookup.js";

export const scriptTargetOutcomeFor = (
  target: MockDraftScriptTargetMaxBid,
  runs: readonly MockResultsRun[],
): MockResultsScriptTargetOutcome => {
  const rosteredTargets = runs
    .map(run => rosteredTargetFor(run, target.player))
    .filter(isRosteredTarget);
  const ownerTargets = rosteredTargets.filter(result => result.owner === target.owner);
  const salePrices = rosteredTargets.map(result => result.price);

  return {
    owner: target.owner,
    player: target.player,
    maxBid: target.maxBid,
    runCount: runs.length,
    draftedByOwnerCount: ownerTargets.length,
    draftedByOwnerRate: roundToTwo(ownerTargets.length / Math.max(1, runs.length)),
    draftedByOtherCount: rosteredTargets.length - ownerTargets.length,
    undraftedCount: runs.length - rosteredTargets.length,
    missedCount: runs.length - ownerTargets.length,
    averageSalePrice: roundToTwo(average(salePrices)),
    minimumSalePrice: salePrices.length === 0 ? 0 : Math.min(...salePrices),
    maximumSalePrice: salePrices.length === 0 ? 0 : Math.max(...salePrices),
    averageOwnerRankWhenDrafted: roundToTwo(
      average(ownerTargets.map(result => result.team.projectedRank ?? 0)),
    ),
    averageOwnerWeek1WhenDrafted: roundToTwo(
      average(ownerTargets.map(result => result.team.week1Score)),
    ),
    averageOwnerSeasonStrengthWhenDrafted: roundToTwo(
      average(ownerTargets.map(result => result.team.seasonStrengthScore)),
    ),
  };
};
