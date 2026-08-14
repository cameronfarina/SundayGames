import type { Owner } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp } from "../coreMath.js";
import type { NominationContext } from "../nominationTypes.js";

export const nominationOpponentNeedScoreFor = (
  nominator: Owner,
  player: Player,
  context: NominationContext,
  config: AuctionEngineConfig,
): number => {
  const otherOwnerContexts = context.ownerContexts.filter(
    ownerContext => ownerContext.state.owner !== nominator,
  );
  if (otherOwnerContexts.length === 0) return 0;

  const totalNeed = otherOwnerContexts.reduce((total, ownerContext) => {
    const needScore = ownerContext.needScore[player.position];
    if (needScore <= 0) return total;
    if (ownerContext.capacity[player.position] <= 0) return total;

    const reservePrice = Math.max(
      config.minimumBid,
      Math.round(player.price * config.reservePriceRatio),
    );
    if (ownerContext.state.maxBid < reservePrice) return total;

    const affordabilityScore = player.price <= config.minimumBid
      ? 1
      : clamp(ownerContext.state.maxBid / player.price, 0, 1);
    return total + needScore * affordabilityScore;
  }, 0);

  return clamp(totalNeed / otherOwnerContexts.length, 0, 1);
};
