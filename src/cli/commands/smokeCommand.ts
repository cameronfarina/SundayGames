import { keepers } from "../../../config/keepers.js";
import { runMockBatch } from "../../modeling/mockBatch.js";
import { buildMockSmokeReport } from "../../modeling/mockSmoke.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioOption } from "../options/commonOptions.js";

export const runSmokeCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const scenarioKey = scenarioOption(arguments_);
  const seed = arguments_.option("--seed") ?? "smoke";
  const batch = runMockBatch({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: arguments_.positiveInteger("--runs", 2),
    seedPrefix: seed,
    pricingConfig,
  });
  const run = batch.runs[0];
  if (!run) throw new Error("Smoke command did not produce a mock run.");
  console.log(JSON.stringify(buildMockSmokeReport({ run, batch, rounds: 2 }), null, 2));
};
