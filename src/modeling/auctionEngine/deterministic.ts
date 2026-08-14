import type { Owner } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { hashDivisor } from "./constants.js";
import { clamp } from "./coreMath.js";

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const deterministicTieBreak = (
  seed: string,
  owner: Owner,
  playerName: string,
): number =>
  hashString(`${seed}|${owner}|${playerName}`) / hashDivisor;

export const bidVarianceMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  if (player.price < config.bidVariance.minimumPlayerPrice) return 1;

  const priceRange = Math.max(
    1,
    config.bidVariance.fullEffectPlayerPrice - config.bidVariance.minimumPlayerPrice,
  );
  const priceScale = clamp(
    (player.price - config.bidVariance.minimumPlayerPrice) / priceRange,
    0,
    1,
  );
  const roll = deterministicTieBreak(`${config.seed}:bid-variance`, state.owner, player.name);
  if (roll < 0.5) {
    return 1 - ((0.5 - roll) / 0.5) * config.bidVariance.maxDiscount * priceScale;
  }

  return 1 + ((roll - 0.5) / 0.5) * config.bidVariance.maxPremium * priceScale;
};
