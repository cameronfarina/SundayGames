import type { AuctionEngineConfigOverrides } from "../auctionEngine.js";
import { threeRbAuctionVariantFor } from "./auctionVariants.js";
import type { DraftPlanAuctionOverridesOptions } from "./contracts.js";
import { genericAuctionOverridesFor } from "./genericAuctionOverrides.js";
import { threeRbAuctionOverridesFor } from "./threeRbAuctionOverrides.js";

export const draftPlanAuctionOverridesFor = ({
  owner,
  strategyKey,
  variantSeed,
}: DraftPlanAuctionOverridesOptions): AuctionEngineConfigOverrides =>
  genericAuctionOverridesFor(owner, strategyKey) ??
  threeRbAuctionOverridesFor(owner, threeRbAuctionVariantFor(variantSeed));
