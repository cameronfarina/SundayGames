import { keepers } from "../../../config/keepers.js";
import { runStrategyLab, strategyLabReportMarkdown } from "../../modeling/strategyLab.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioOption } from "../options/commonOptions.js";
import { strategyLabScenariosOption } from "../options/strategyLabOptions.js";

export const runStrategyLabCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const customScenarios = strategyLabScenariosOption(arguments_);
  const report = await runStrategyLab({
    projections: players,
    historicalRecords,
    keepers,
    ...(customScenarios === undefined ? {} : { scenarios: customScenarios }),
    scenarioKey: scenarioOption(arguments_),
    runsPerScenario: arguments_.positiveInteger("--runs", 25),
    seedPrefix: arguments_.option("--seed-prefix") ?? "strategy-lab",
    pricingConfig,
  });
  const format = arguments_.option("--format") ?? "json";
  if (format === "markdown") {
    console.log(strategyLabReportMarkdown(report));
    return;
  }
  if (format !== "json") throw new Error(`Unknown strategy lab format "${format}". Use json or markdown.`);
  console.log(JSON.stringify(report, null, 2));
};
