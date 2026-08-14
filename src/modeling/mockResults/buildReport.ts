import type { Owner } from "../../../config/league.js";
import { primaryOwner } from "../../../config/league.js";
import type { MockBatch } from "../mockBatch.js";
import type { MockDraftScript } from "../mockScript.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import { analyticsFor } from "./buildAnalytics.js";
import type { MockResultsReport } from "./reportContracts.js";
import { runResultFor } from "./runResult.js";
import { scriptSummaryFor } from "./scriptSummary.js";

export const buildMockResultsReport = (
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  runStrategyKeys: readonly LiveDraftStrategyKey[] = [],
  script?: MockDraftScript,
  runLabels: readonly string[] = [],
  watchOwner: Owner = primaryOwner,
): MockResultsReport => {
  const cam = batch.summary.owners.find(owner => owner.owner === watchOwner);
  const resolvedKeys = batch.runs.map((_run, index) => runStrategyKeys[index] ?? strategyKey);
  const runs = batch.runs.map((run, index) =>
    runResultFor(run, index, resolvedKeys[index] ?? strategyKey, runLabels[index], watchOwner));

  return {
    mode: "batch-mock",
    watchOwner,
    options: { ...batch.options, strategyKey },
    summary: batch.summary,
    runStrategyKeys: resolvedKeys,
    runs,
    analytics: analyticsFor(runs, batch, strategyKey, watchOwner),
    ...(script === undefined ? {} : { script: scriptSummaryFor(script, runs, batch.options.runsPerScenario) }),
    ...(cam === undefined ? {} : { cam }),
    camTopExposures: batch.summary.ownerPlayerExposure
      .filter(exposure => exposure.owner === watchOwner)
      .slice(0, 12),
    topPlayers: batch.summary.players.slice(0, 12),
  };
};
