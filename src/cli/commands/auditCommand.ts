import { keepers } from "../../../config/keepers.js";
import { buildPlayerPriceAudit } from "../../modeling/playerPriceAudit.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioOption } from "../options/commonOptions.js";

export const runAuditCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  console.log(JSON.stringify(buildPlayerPriceAudit({
    playerName: arguments_.required("--player"),
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOption(arguments_),
    runs: arguments_.positiveInteger("--runs", 10),
    seedPrefix: arguments_.option("--seed-prefix") ?? "player-audit",
    pricingConfig,
  }), null, 2));
};
