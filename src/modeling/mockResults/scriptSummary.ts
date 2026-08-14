import type { MockDraftScript } from "../mockScript.js";
import { scriptBuildAroundOutcomesFor } from "./buildAroundOutcomes.js";
import type { MockResultsRun } from "./reportContracts.js";
import type { MockResultsScriptSummary } from "./scriptContracts.js";
import { scriptTargetOutcomeFor } from "./targetOutcomes.js";

export const scriptSummaryFor = (
  script: MockDraftScript,
  runs: readonly MockResultsRun[],
  runsPerPricePoint: number,
): MockResultsScriptSummary => ({
  raw: script.raw,
  label: script.label,
  ...(script.buildAround === undefined
    ? {}
    : {
      buildAround: script.buildAround,
      buildAroundOutcomes: scriptBuildAroundOutcomesFor(script, runs, runsPerPricePoint),
    }),
  targetMaxBids: [...script.targetMaxBids],
  targetOutcomes: script.targetMaxBids.map(target => scriptTargetOutcomeFor(target, runs)),
  ...(script.runsPerScenario === undefined ? {} : { runsPerScenario: script.runsPerScenario }),
});
