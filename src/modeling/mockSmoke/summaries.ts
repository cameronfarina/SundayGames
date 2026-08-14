import type { MockBatch } from "../mockBatch.js";
import type {
  MockSmokeBatchSummary,
  MockSmokePick,
  MockSmokeRoundSummary,
} from "./contracts.js";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

export const summarizeSmokePicks = (
  picks: readonly MockSmokePick[],
): MockSmokeRoundSummary => ({
  pickCount: picks.length,
  averageAnchorPrice: roundToTwo(average(picks.map(pick => pick.anchorPrice))),
  averageSalePrice: roundToTwo(average(picks.map(pick => pick.salePrice))),
  averageSaleVsAnchor: roundToTwo(average(picks.map(pick => pick.saleVsAnchor))),
});

export const summarizeSmokeBatch = (batch: MockBatch): MockSmokeBatchSummary => ({
  runCount: batch.runs.length,
  invalidRosterCount: batch.summary.scenarios.reduce(
    (count, scenario) => count + scenario.invalidRosterCount,
    0,
  ),
  scenarios: batch.summary.scenarios.map(scenario => ({
    key: scenario.key,
    runCount: scenario.runCount,
    invalidRosterCount: scenario.invalidRosterCount,
    averagePickCount: scenario.averagePickCount,
  })),
});
