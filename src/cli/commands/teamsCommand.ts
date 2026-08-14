import { keepers } from "../../../config/keepers.js";
import {
  buildDraftPlanReport,
  draftPlanAuctionOverridesFor,
  draftPlanReportCsv,
} from "../../modeling/draftPlan.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { ownerOption, scenarioOption } from "../options/commonOptions.js";
import {
  draftPlanEngineModeOption,
  draftPlanStrategyModeOption,
  draftPlanStrategyOption,
} from "../options/draftPlanOptions.js";
import { draftPlanReportMarkdown } from "../reporting/draftPlanMarkdown.js";

export const runTeamsCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const owner = ownerOption(arguments_);
  const strategyKey = draftPlanStrategyOption(arguments_);
  const strategyMode = draftPlanStrategyModeOption(arguments_);
  const engineMode = draftPlanEngineModeOption(arguments_);
  const batch = runMockBatch({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioOption(arguments_)],
    runsPerScenario: arguments_.positiveInteger("--runs", 250),
    seedPrefix: arguments_.option("--seed-prefix") ?? "draft-plans",
    pricingConfig,
    auctionConfigOverrides: strategyMode === "force"
      ? draftPlanAuctionOverridesFor({ owner, strategyKey })
      : {},
    diagnosticsMode: engineMode === "fast" ? "summary" : "full",
  });
  const report = buildDraftPlanReport({
    batch,
    owner,
    strategyKey,
    limit: arguments_.positiveInteger("--limit", 5),
  });
  const format = arguments_.option("--format") ?? "json";
  if (format === "markdown") console.log(draftPlanReportMarkdown(report));
  else if (format === "csv") console.log(draftPlanReportCsv(report));
  else if (format === "json") console.log(JSON.stringify(report, null, 2));
  else throw new Error(`Unknown teams format "${format}". Use json, markdown, or csv.`);
};
