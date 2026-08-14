import { keepers } from "../../../config/keepers.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioListOption } from "../options/commonOptions.js";

export const runMocksCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const batch = runMockBatch({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKeys: scenarioListOption(arguments_),
    runsPerScenario: arguments_.positiveInteger("--runs", 50),
    seedPrefix: arguments_.option("--seed-prefix") ?? "mockd",
    pricingConfig,
  });
  console.log(JSON.stringify({
    options: batch.options,
    summary: batch.summary,
    runCount: batch.runs.length,
  }, null, 2));
};
