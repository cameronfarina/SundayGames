import type { Player } from "../../../types.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp } from "../coreMath.js";
import type { NominationOwnerContext } from "../nominationTypes.js";

export const nominationContextCanBidOnPlayer = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean =>
  context.state.maxBid >= config.minimumBid &&
  context.canCompleteAfterAdding[player.position] &&
  remainingPlayersAtPlayerPosition >= context.directShortageAfterPick[player.position];

export const nominationAffordabilityScoreFor = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): number => {
  if (!nominationContextCanBidOnPlayer(context, player, remainingPlayersAtPlayerPosition, config)) {
    return 0;
  }
  if (player.price <= config.minimumBid) return 1;

  return clamp(context.state.maxBid / player.price, 0, 1);
};
