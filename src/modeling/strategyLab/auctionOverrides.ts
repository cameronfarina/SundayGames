import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type {
  AuctionEngineConfigOverrides,
  OwnerPlayerTargetMaxBids,
} from "../auctionEngine.js";
import type { StrategyLabTargetMaxBid } from "./scenarioContracts.js";

export const targetMaxBidOverridesFor = (
  targetMaxBids: readonly StrategyLabTargetMaxBid[],
): AuctionEngineConfigOverrides => {
  const ownerPlayerTargetMaxBids: OwnerPlayerTargetMaxBids = {};

  for (const target of targetMaxBids) {
    ownerPlayerTargetMaxBids[target.owner] = {
      ...(ownerPlayerTargetMaxBids[target.owner] ?? {}),
      [normalizePlayerName(target.player)]: target.maxBid,
    };
  }

  return { ownerPlayerTargetMaxBids };
};
