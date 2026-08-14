import { keepers } from "../../../config/keepers.js";
import { buildBasePrices } from "../../modeling/basePricing.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "../../modeling/keeperScenarioSensitivity.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";

export const runScenarioSensitivityCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const report = buildKeeperScenarioSensitivityReport({
    prices: buildBasePrices(players, historicalRecords, pricingConfig),
    keepers,
    limit: arguments_.positiveInteger("--limit", 60),
  });
  const format = arguments_.option("--format") ?? "json";
  if (format === "csv") {
    console.log(keeperScenarioSensitivityCsv(report));
    return;
  }
  if (format !== "json") {
    throw new Error(`Unknown scenario sensitivity format "${format}". Use json or csv.`);
  }
  console.log(JSON.stringify(report, null, 2));
};
