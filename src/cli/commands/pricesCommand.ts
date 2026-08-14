import { buildBasePrices, summarizePricePool } from "../../modeling/basePricing.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { playerContextSummary, playerEvidencePathOption } from "../options/pricingOptions.js";

export const runPricesCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const prices = buildBasePrices(players, historicalRecords, pricingConfig);
  console.log(JSON.stringify({
    config: {
      draftedPoolCounts: pricingConfig.draftedPoolCounts,
      positionMarketMultipliers: pricingConfig.positionMarketMultipliers,
      rankGapAdjustmentCap: pricingConfig.rankGapAdjustmentCap,
      marketPressureByPosition: pricingConfig.marketPressureByPosition,
      hardPriceCeilings: pricingConfig.hardPriceCeilings,
      topPriceVolumeLimits: pricingConfig.topPriceVolumeLimits,
      playerContext: playerContextSummary(
        pricingConfig,
        arguments_.option("--player-context"),
        playerEvidencePathOption(arguments_),
      ),
    },
    summary: summarizePricePool(prices),
    prices,
  }, null, 2));
};
