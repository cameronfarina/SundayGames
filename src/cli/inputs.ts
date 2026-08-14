import { loadHistoricalAuctionRecords } from "../data/parseHistoricalBoards.js";
import type { PricingConfig } from "../modeling/basePricing.js";
import { loadCurrentProjections } from "../projections.js";
import type { CliArguments } from "./arguments.js";
import { pricingConfigOption } from "./options/pricingOptions.js";

export const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

export const loadProjectionAndHistory = async () => ({
  players: await loadCurrentProjections({ projectionPath }),
  historicalRecords: await loadHistoricalAuctionRecords(),
});

export const loadPricingInputs = async (arguments_: CliArguments): Promise<{
  pricingConfig: PricingConfig;
  players: Awaited<ReturnType<typeof loadCurrentProjections>>;
  historicalRecords: Awaited<ReturnType<typeof loadHistoricalAuctionRecords>>;
}> => {
  const pricingConfig = await pricingConfigOption(arguments_);
  const { players, historicalRecords } = await loadProjectionAndHistory();
  return { pricingConfig, players, historicalRecords };
};
