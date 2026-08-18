import {
  isAutomatedAuctionAcquisitionEligible,
  maximumAutomatedAuctionBidFor,
  type GenericAuctionMockBoardPlayer,
  type GenericAuctionMockState,
  type GenericAuctionMockTeamReadModel,
} from "../genericAuctionMockEngine.js";
import {
  activePositionPreferenceFor,
  preferenceRosterCountFor,
  type ResolvedSeasonSimulationPreference,
} from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import { singleBidCapFor } from "../auction/closingPrice.js";
import { backupDepthMaximumBidFor } from "../auction/backupDepth.js";
import { flatPricedAuctionDollars, flatPricedAuctionPositions } from "../auction/pricingConstants.js";
import { auctionValueLimitFor } from "./auctionValueLimit.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import {
  auctionRosterNeedFor,
  canAuctionTeamRoster,
  minimumTargetAcquisitionCostFor,
  plannedFutureTargetsFor,
  preservesSlotsForTargets,
} from "./auctionTargets.js";

export interface AuctionWillingness {
  willingness: number;
  // The manager's own plan (targets, price caps, preferences): the only
  // limits that still bind when spend-down closes a final-slot purchase.
  finalSlotCeiling: number;
}

export const auctionWillingnessDetailFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
  preferences: readonly ResolvedSeasonSimulationPreference[],
): AuctionWillingness => {
  const target = targetsByPlayerId.get(player.id);
  const isTarget = target !== undefined;
  const isUncappedTarget = isTarget && target.maxAuctionPrice === undefined;
  if (
    isUncappedTarget
      ? !canAuctionTeamRoster(state, team, player)
      : !isAutomatedAuctionAcquisitionEligible(state, team, player)
  ) return { willingness: 0, finalSlotCeiling: 0 };

  // A kicker or defense costs two dollars unless this manager named him.
  if (flatPricedAuctionPositions.has(player.position) && !isTarget) {
    const flatPrice = Math.min(
      team.maxBid,
      Math.max(state.configuration.minimumBidDollars, flatPricedAuctionDollars),
    );
    return { willingness: flatPrice, finalSlotCeiling: flatPrice };
  }

  const isPair = player.id === pairPlayerId;
  const preference = activePositionPreferenceFor(
    preferences,
    team.roster,
    player,
    pairPlayerId,
  );
  // A backup specialist never earns starter money unless this manager asked
  // for the depth by naming the player or the position.
  const backupDepthMaximum = backupDepthMaximumBidFor(state, team, player);
  if (
    backupDepthMaximum !== undefined
    && !isTarget && !isPair && preference === undefined
  ) {
    const backupPrice = Math.min(team.maxBid, backupDepthMaximum);
    return { willingness: backupPrice, finalSlotCeiling: backupPrice };
  }
  const positionPreference = preferences.find(candidate =>
    candidate.preference.position === player.position
    && preferenceRosterCountFor(team.roster, candidate, pairPlayerId) < candidate.targetCount
  );
  const positionCap = [...(strategy.positionCaps ?? [])]
    .reverse()
    .find(cap => cap.position === player.position);
  const isPreferred = preference !== undefined;
  const valueLimit = auctionValueLimitFor({
    state,
    team,
    player,
    isTarget,
    isPair,
    isPreferred,
    pressureExempt: state.configuration.ai?.bidPressureExemptPlayerIds
      ?.includes(player.id) ?? false,
  });
  const plannedTargetPlayers = plannedFutureTargetsFor(
    state,
    team,
    player,
    targetsByPlayerId,
  );
  if (
    !isTarget
    && plannedTargetPlayers.some(targetPlayer => targetPlayer.position === player.position)
  ) return { willingness: 0, finalSlotCeiling: 0 };
  const reservedTargetBudget = plannedTargetPlayers.reduce(
    (total, targetPlayer) => total + Math.max(
      0,
      minimumTargetAcquisitionCostFor(state, targetPlayer, targetsByPlayerId)
        - state.configuration.minimumBidDollars,
    ),
    0,
  );
  const preservesTargetSlots = preservesSlotsForTargets(
    state,
    team,
    player,
    plannedTargetPlayers,
  );
  const strategyLimit = Math.min(
    team.maxBid,
    isUncappedTarget ? team.maxBid : maximumAutomatedAuctionBidFor(state, team, player),
    Math.max(0, team.maxBid - reservedTargetBudget),
    preservesTargetSlots ? team.maxBid : 0,
    target?.maxAuctionPrice ?? team.maxBid,
    positionCap === undefined || (positionCap.excludeNamedTargets && isTarget)
      ? team.maxBid
      : positionCap.maxAuctionPrice,
    isTarget ? team.maxBid : positionPreference?.preference.maxAuctionPrice ?? team.maxBid,
  );
  let enforcedValueLimit = team.maxBid;
  if ((!isTarget || target.maxAuctionPrice !== undefined) && preference === undefined) {
    enforcedValueLimit = valueLimit;
  }

  // A named target or an explicit position preference is the manager's own
  // plan, so it pierces the league-wide single-bid cap.
  const singleBidCap = isTarget || isPreferred
    ? team.maxBid
    : singleBidCapFor(state, player);
  return {
    willingness: Math.min(team.maxBid, singleBidCap, strategyLimit, enforcedValueLimit),
    finalSlotCeiling: Math.min(team.maxBid, singleBidCap, strategyLimit),
  };
};
