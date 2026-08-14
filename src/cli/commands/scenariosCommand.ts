import { keepers } from "../../../config/keepers.js";
import { buildBasePrices } from "../../modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../../modeling/keeperInflation.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { playerContextSummary, playerEvidencePathOption } from "../options/pricingOptions.js";

export const runScenariosCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const prices = buildBasePrices(players, historicalRecords, pricingConfig);
  console.log(JSON.stringify({
    config: {
      playerContext: playerContextSummary(
        pricingConfig,
        arguments_.option("--player-context"),
        playerEvidencePathOption(arguments_),
      ),
    },
    scenarios: buildKeeperScenarios(keepers)
      .map(scenario => applyKeeperScenarioToPrices(prices, scenario, keepers)),
  }, null, 2));
};
