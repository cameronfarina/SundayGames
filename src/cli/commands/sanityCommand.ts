import { keepers } from "../../../config/keepers.js";
import { buildTopPlayerSanityReport } from "../../modeling/topPlayerSanity.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioOption } from "../options/commonOptions.js";

export const runSanityCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  console.log(JSON.stringify(buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOption(arguments_),
    limit: arguments_.positiveInteger("--limit", 40),
    runs: arguments_.positiveInteger("--runs", 10),
    seedPrefix: arguments_.option("--seed-prefix") ?? "top-sanity",
    pricingConfig,
  }), null, 2));
};
