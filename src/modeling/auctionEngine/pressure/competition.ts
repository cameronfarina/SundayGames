import type { Position } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import { ownerCanBidOnPlayer } from "../bidEligibility.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp, isFlexEligible, isPremiumPosition } from "../coreMath.js";
import { countPositions } from "../ownerStates.js";
import { flexEligibleCount, minimumFlexEligibleCount } from "../rosterRules.js";

export const positionNeedTypeFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): "starter" | "flex" | undefined => {
  const counts = countPositions(state.roster);
  if (counts[position] < config.starterMinimums[position]) return "starter";
  if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    return "flex";
  }
  return undefined;
};

export const rivalAnchorCountFor = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const pressure = config.competitionPressure;
  const anchorPrice = Math.max(
    pressure.minimumPlayerPrice,
    Math.ceil(player.price * pressure.anchorPriceRatio),
  );
  return ownerStates.filter(rival =>
    rival.owner !== state.owner &&
    rival.roster.some(rostered =>
      rostered.position === player.position && rostered.price >= anchorPrice
    ) &&
    ownerCanBidOnPlayer(rival, player, ownerStates, remainingPlayers, config)
  ).length;
};

export const competitionPressureMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const pressure = config.competitionPressure;
  if (!isPremiumPosition(player.position) || player.price < pressure.minimumPlayerPrice) return 1;
  const needType = positionNeedTypeFor(state, player.position, config);
  if (!needType) return 1;
  const rivalAnchors = Math.min(
    pressure.maxRivalAnchors,
    rivalAnchorCountFor(state, player, ownerStates, remainingPlayers, config),
  );
  if (rivalAnchors <= 0) return 1;
  const slope = needType === "starter"
    ? pressure.missingStarterSlope
    : pressure.missingFlexSlope;
  return clamp(1 + rivalAnchors * slope, 1, pressure.maxMultiplier);
};
