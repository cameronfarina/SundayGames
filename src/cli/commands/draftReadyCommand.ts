import { keepers } from "../../../config/keepers.js";
import {
  buildDraftPlanReport,
  draftPlanAuctionOverridesFor,
} from "../../modeling/draftPlan.js";
import { buildDraftReadyReport } from "../../modeling/draftReadiness.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import type { CliArguments } from "../arguments.js";
import { buildDraftReadinessQa } from "../draftReadiness/qa.js";
import { loadPricingInputs } from "../inputs.js";
import { ownerOption, scenarioOption } from "../options/commonOptions.js";
import {
  draftPlanEngineModeOption,
  draftPlanStrategyModeOption,
  draftPlanStrategyOption,
} from "../options/draftPlanOptions.js";

export const runDraftReadyCommand = async (arguments_: CliArguments): Promise<number> => {
  const inputs = await loadPricingInputs(arguments_);
  const scenarioKey = scenarioOption(arguments_);
  const owner = ownerOption(arguments_);
  const strategyKey = draftPlanStrategyOption(arguments_);
  const strategyMode = draftPlanStrategyModeOption(arguments_);
  const engineMode = draftPlanEngineModeOption(arguments_);
  const runs = arguments_.positiveInteger("--runs", 50);
  const qaRuns = arguments_.positiveInteger("--qa-runs", 10);
  const seedPrefix = arguments_.option("--seed-prefix") ?? "draft-ready";
  const minimumMatches = arguments_.positiveInteger(
    "--min-matches",
    Math.max(1, Math.ceil(runs * 0.2)),
  );
  const qaReport = buildDraftReadinessQa(
    arguments_,
    inputs,
    scenarioKey,
    qaRuns,
    `${seedPrefix}:qa`,
  );
  const planBatch = runMockBatch({
    projections: inputs.players,
    historicalRecords: inputs.historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: runs,
    seedPrefix: `${seedPrefix}:plans`,
    pricingConfig: inputs.pricingConfig,
    auctionConfigOverrides: strategyMode === "force"
      ? draftPlanAuctionOverridesFor({ owner, strategyKey })
      : {},
    diagnosticsMode: engineMode === "fast" ? "summary" : "full",
  });
  const draftPlanReport = buildDraftPlanReport({
    batch: planBatch,
    owner,
    strategyKey,
    limit: arguments_.positiveInteger("--limit", 5),
  });
  const report = buildDraftReadyReport({
    options: {
      owner,
      strategyKey,
      strategyMode,
      scenarioKey,
      runs,
      qaRuns,
      seedPrefix,
      engineMode,
      minimumMatches,
    },
    dataCounts: {
      projections: inputs.players.length,
      historicalRecords: inputs.historicalRecords.length,
      keepers: keepers.length,
    },
    qaReport,
    draftPlanReport,
    planBatch,
  });
  console.log(JSON.stringify(report, null, 2));
  return report.recommendedExitCode;
};
