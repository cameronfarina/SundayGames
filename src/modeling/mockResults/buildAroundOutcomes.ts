import type { MockDraftScript } from "../mockScript.js";
import { average, roundToTwo } from "./formatting.js";
import type { MockResultsRun } from "./reportContracts.js";
import type { MockResultsScriptBuildAroundOutcome } from "./scriptContracts.js";
import { isRosteredTarget, rosteredTargetFor } from "./targetLookup.js";

const compareBestCamOutcomeRuns = (left: MockResultsRun, right: MockResultsRun): number =>
  left.camOutcome.rank - right.camOutcome.rank ||
  right.camOutcome.seasonStrengthScore - left.camOutcome.seasonStrengthScore ||
  right.camOutcome.week1Score - left.camOutcome.week1Score ||
  left.label.localeCompare(right.label);

const compareWorstCamOutcomeRuns = (left: MockResultsRun, right: MockResultsRun): number =>
  right.camOutcome.rank - left.camOutcome.rank ||
  left.camOutcome.seasonStrengthScore - right.camOutcome.seasonStrengthScore ||
  left.camOutcome.week1Score - right.camOutcome.week1Score ||
  left.label.localeCompare(right.label);

export const scriptBuildAroundOutcomesFor = (
  script: MockDraftScript,
  runs: readonly MockResultsRun[],
  runsPerPricePoint: number,
): MockResultsScriptBuildAroundOutcome[] => {
  const buildAround = script.buildAround;
  if (!buildAround) return [];

  const safeRunsPerPricePoint = Math.max(1, Math.floor(runsPerPricePoint));
  return buildAround.prices.map((price, priceIndex) => {
    const priceRuns = runs.slice(
      priceIndex * safeRunsPerPricePoint,
      (priceIndex + 1) * safeRunsPerPricePoint,
    );
    const rosteredTargets = priceRuns
      .map(run => rosteredTargetFor(run, buildAround.player))
      .filter(isRosteredTarget);
    const ownerTargets = rosteredTargets.filter(result => result.owner === buildAround.owner);
    const salePrices = rosteredTargets.map(result => result.price);
    const bestRun = [...priceRuns].sort(compareBestCamOutcomeRuns)[0];
    const worstRun = [...priceRuns].sort(compareWorstCamOutcomeRuns)[0];

    return {
      owner: buildAround.owner,
      player: buildAround.player,
      price,
      runCount: priceRuns.length,
      draftedByOwnerCount: ownerTargets.length,
      draftedByOwnerRate: roundToTwo(ownerTargets.length / Math.max(1, priceRuns.length)),
      draftedByOtherCount: rosteredTargets.length - ownerTargets.length,
      undraftedCount: priceRuns.length - rosteredTargets.length,
      averageSalePrice: roundToTwo(average(salePrices)),
      minimumSalePrice: salePrices.length === 0 ? 0 : Math.min(...salePrices),
      maximumSalePrice: salePrices.length === 0 ? 0 : Math.max(...salePrices),
      averageCamRank: roundToTwo(average(priceRuns.map(run => run.camOutcome.rank))),
      averageCamWeek1Score: roundToTwo(average(priceRuns.map(run => run.camOutcome.week1Score))),
      averageCamWeeks1To4Score: roundToTwo(
        average(priceRuns.map(run => run.camOutcome.weeks1To4Score)),
      ),
      averageCamSeasonStrengthScore: roundToTwo(
        average(priceRuns.map(run => run.camOutcome.seasonStrengthScore)),
      ),
      averageCamBudgetRemaining: roundToTwo(
        average(priceRuns.map(run => run.camOutcome.budgetRemaining)),
      ),
      bestRunLabel: bestRun?.label ?? "",
      worstRunLabel: worstRun?.label ?? "",
    };
  });
};
