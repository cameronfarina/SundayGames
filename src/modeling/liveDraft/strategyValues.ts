import type { PricingConfig } from "../basePricing.js";
import {
  liveDraftStrategies,
  type LiveDraftStrategyKey,
} from "../liveDraftStrategies.js";
import type { LiveDraftOwnerState } from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { personalValueForStrategy } from "./strategyValuation.js";

const strategyValueFor = ({
  player,
  watchOwner,
  liveExpectedPrice,
  strategyKey,
  pricingConfig,
  fitsRoster,
}: {
  player: LiveDraftPlayerRecord;
  watchOwner: LiveDraftOwnerState;
  liveExpectedPrice: number;
  strategyKey: LiveDraftStrategyKey;
  pricingConfig: PricingConfig;
  fitsRoster: boolean;
}): number => fitsRoster ? personalValueForStrategy({
  player,
  watchOwner,
  liveExpectedPrice,
  strategy: liveDraftStrategies[strategyKey],
  pricingConfig,
}) : 0;

export const strategyValuesFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  liveExpectedPrice: number,
  pricingConfig: PricingConfig,
  fitsRoster: boolean,
): Record<LiveDraftStrategyKey, number> => ({
  balanced: strategyValueFor({
    player, watchOwner, liveExpectedPrice, strategyKey: "balanced", pricingConfig, fitsRoster,
  }),
  "three-rb": strategyValueFor({
    player, watchOwner, liveExpectedPrice, strategyKey: "three-rb", pricingConfig, fitsRoster,
  }),
  "hero-rb": strategyValueFor({
    player, watchOwner, liveExpectedPrice, strategyKey: "hero-rb", pricingConfig, fitsRoster,
  }),
  "wr-heavy": strategyValueFor({
    player, watchOwner, liveExpectedPrice, strategyKey: "wr-heavy", pricingConfig, fitsRoster,
  }),
});
