import type { MockRun, ScenarioBatchSummary } from "./contracts.js";
import { average, roundToTwo } from "./math.js";

export const summarizeScenarios = (runs: readonly MockRun[]): ScenarioBatchSummary[] =>
  [...new Set(runs.map(run => run.keeperScenario.key))].map(scenarioKey => {
    const scenarioRuns = runs.filter(run => run.keeperScenario.key === scenarioKey);
    const firstRun = scenarioRuns[0];
    if (!firstRun) throw new Error(`Missing runs for scenario "${scenarioKey}".`);

    return {
      key: scenarioKey,
      label: firstRun.keeperScenario.label,
      runCount: scenarioRuns.length,
      invalidRosterCount: scenarioRuns.reduce(
        (total, run) => total + run.invalidRosterCount,
        0,
      ),
      averagePickCount: roundToTwo(average(scenarioRuns.map(run => run.pickCount))),
    };
  });
