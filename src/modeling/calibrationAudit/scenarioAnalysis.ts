import { ownerOrder } from "../../../config/league.js";
import type { MockBatch, MockRun } from "../mockBatch.js";
import type { ScenarioCalibration } from "./contracts/calibration.js";
import { average, max, roundToTwo } from "./numeric.js";
import {
  scenarioOpenAuctionDollars,
  totalMockAuctionSpend,
} from "./overallAnalysis.js";

const runAverageBudgetRemaining = (run: MockRun): number =>
  average(run.rosters.map(roster => roster.budgetRemaining));

const maxOwnerAverageBudgetRemainingForRuns = (
  runs: readonly MockRun[],
): number =>
  max(ownerOrder.map(owner =>
    average(runs.flatMap(run =>
      run.rosters
        .filter(roster => roster.owner === owner)
        .map(roster => roster.budgetRemaining),
    )),
  ));

export const summarizeScenarioCalibration = (
  batch: MockBatch,
): ScenarioCalibration[] =>
  batch.summary.scenarios.map(scenario => {
    const runs = batch.runs.filter(
      run => run.keeperScenario.key === scenario.key,
    );
    const scenarioAverageOpenAuctionDollars = roundToTwo(
      scenarioOpenAuctionDollars(runs),
    );
    const mockAverageAuctionSpend = roundToTwo(totalMockAuctionSpend(runs));

    return {
      key: scenario.key,
      label: scenario.label,
      runCount: scenario.runCount,
      invalidRosterCount: scenario.invalidRosterCount,
      averagePickCount: scenario.averagePickCount,
      scenarioAverageOpenAuctionDollars,
      mockAverageAuctionSpend,
      scenarioAuctionSpendDelta: roundToTwo(
        mockAverageAuctionSpend - scenarioAverageOpenAuctionDollars,
      ),
      leagueAverageBudgetRemaining: roundToTwo(
        average(runs.map(runAverageBudgetRemaining)),
      ),
      maxOwnerAverageBudgetRemaining: roundToTwo(
        maxOwnerAverageBudgetRemainingForRuns(runs),
      ),
    };
  });
