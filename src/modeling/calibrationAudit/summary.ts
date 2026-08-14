import { ownerOrder } from "../../../config/league.js";
import type { MockBatch } from "../mockBatch.js";
import type {
  OwnerSpendCalibration,
  PositionCountCalibration,
  PositionSpendCalibration,
  PriceTierCalibration,
} from "./contracts/calibration.js";
import type {
  BudgetRemainingCalibrationSummary,
  CalibrationDeltaSummary,
  CalibrationSummary,
} from "./contracts/report.js";
import { average, roundToTwo } from "./numeric.js";

const byAbsoluteDelta = (
  left: CalibrationDeltaSummary,
  right: CalibrationDeltaSummary,
): number =>
  Math.abs(right.delta) - Math.abs(left.delta) ||
  left.key.localeCompare(right.key);

const topDeltaSummaries = (
  summaries: readonly CalibrationDeltaSummary[],
  limit: number,
): CalibrationDeltaSummary[] =>
  [...summaries].sort(byAbsoluteDelta).slice(0, limit);

const summarizeBudgetRemaining = (
  batch: MockBatch,
): BudgetRemainingCalibrationSummary => ({
  leagueAverageBudgetRemaining: roundToTwo(
    average(batch.summary.owners.map(owner => owner.averageBudgetRemaining)),
  ),
  ownersWithAverageBudgetRemaining: batch.summary.owners
    .filter(owner => owner.averageBudgetRemaining > 0)
    .map(owner => ({
      owner: owner.owner,
      averageBudgetRemaining: owner.averageBudgetRemaining,
    }))
    .sort((left, right) =>
      right.averageBudgetRemaining - left.averageBudgetRemaining ||
      ownerOrder.indexOf(left.owner) - ownerOrder.indexOf(right.owner),
    ),
});

export const summarizeCalibration = (
  batch: MockBatch,
  priceTierCalibration: readonly PriceTierCalibration[],
  positionCountCalibration: readonly PositionCountCalibration[],
  positionSpendCalibration: readonly PositionSpendCalibration[],
  ownerSpendCalibration: readonly OwnerSpendCalibration[],
): CalibrationSummary => ({
  runCount: batch.runs.length,
  scenarioKeys: batch.options.scenarioKeys,
  runsPerScenario: batch.options.runsPerScenario,
  largestPriceTierCountDeltas: topDeltaSummaries(
    priceTierCalibration.map(tier => ({
      key: tier.key,
      label: tier.label,
      target: tier.historicalAverageCount,
      actual: tier.mockAverageCount,
      delta: tier.countDelta,
    })),
    3,
  ),
  largestPositionCountDeltas: topDeltaSummaries(
    positionCountCalibration.map(position => ({
      key: position.position,
      label: position.position,
      target: position.historicalAverageCount,
      actual: position.mockAverageCount,
      delta: position.delta,
    })),
    3,
  ),
  largestPositionSpendDeltas: topDeltaSummaries(
    positionSpendCalibration.map(position => ({
      key: position.position,
      label: position.position,
      target: position.scenarioAverageSpendTarget,
      actual: position.mockAverageSpend,
      delta: position.scenarioSpendDelta,
    })),
    3,
  ),
  largestOwnerSpendDeltas: topDeltaSummaries(
    ownerSpendCalibration.map(owner => ({
      key: owner.owner,
      label: owner.owner,
      target: owner.scenarioAverageOpenAuctionBudget,
      actual: owner.mockAverageAuctionSpend,
      delta: owner.scenarioSpendDelta,
    })),
    5,
  ),
  budgetRemaining: summarizeBudgetRemaining(batch),
});
