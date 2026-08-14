import { keepers } from "../../../config/keepers.js";
import { buildHistoricalCalibrationAudit } from "../../modeling/calibrationAudit.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioListOption } from "../options/commonOptions.js";

export const runCalibrationCommand = async (arguments_: CliArguments): Promise<void> => {
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
    audit: buildHistoricalCalibrationAudit({ historicalRecords, batch }),
  }, null, 2));
};
