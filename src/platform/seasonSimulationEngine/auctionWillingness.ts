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
import { remainingValuePerSlotFor } from "../auction/auctionAnalysis.js";
import { backupDepthMaximumBidFor } from "../auction/backupDepth.js";
import { ownerBidLiftFor } from "../auction/ownerSurplus.js";
import { flatPricedAuctionPositions } from "../auction/pricingConstants.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import {
  auctionRosterNeedFor,
  canAuctionTeamRoster,
  minimumTargetAcquisitionCostFor,
  plannedFutureTargetsFor,
  preservesSlotsForTargets,
} from "./auctionTargets.js";

export const auctionWillingnessFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  strategy: ParsedSeasonSimulationStrategy,
  preferences: readonly ResolvedSeasonSimulationPreference[],
): number => {
  const target = targetsByPlayerId.get(player.id);
  const isTarget = target !== undefined;
  const isUncappedTarget = isTarget && target.maxAuctionPrice === undefined;
  if (
    isUncappedTarget
      ? !canAuctionTeamRoster(state, team, player)
      : !isAutomatedAuctionAcquisitionEligible(state, team, player)
  ) return 0;

  // A kicker or defense costs the minimum bid unless this manager named him.
  if (flatPricedAuctionPositions.has(player.position) && !isTarget) {
    return Math.min(team.maxBid, state.configuration.minimumBidDollars);
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
    return Math.min(team.maxBid, backupDepthMaximum);
  }
  const positionPreference = preferences.find(candidate =>
    candidate.preference.position === player.position
    && preferenceRosterCountFor(team.roster, candidate, pairPlayerId) < candidate.targetCount
  );
  const positionCap = [...(strategy.positionCaps ?? [])]
    .reverse()
    .find(cap => cap.position === player.position);
  const isPreferred = preference !== undefined;
  const needDollars = Math.ceil(auctionRosterNeedFor(team, player.position) * 2);
  const baseValue = team.isHuman ? player.humanValue ?? player.expectedPrice : player.expectedPrice;
  const preferenceDollars = isPreferred ? Math.ceil(baseValue * 0.15) : 0;
  const targetDollars = isTarget || isPair ? Math.ceil(baseValue * 0.1) : 0;
  const ownerLiftDollars = ownerBidLiftFor({
    team,
    position: player.position,
    expectedPrice: baseValue,
    minimumBid: state.configuration.minimumBidDollars,
    remainingValuePerSlot: remainingValuePerSlotFor(state),
    pressureExempt: state.configuration.ai?.bidPressureExemptPlayerIds
      ?.includes(player.id) ?? false,
  });
  const valueLimit = Math.max(
    state.configuration.minimumBidDollars,
    Math.round(baseValue) + needDollars + preferenceDollars + targetDollars
      + ownerLiftDollars,
  );
  const plannedTargetPlayers = plannedFutureTargetsFor(
    state,
    team,
    player,
    targetsByPlayerId,
  );
  if (
    !isTarget
    && plannedTargetPlayers.some(targetPlayer => targetPlayer.position === player.position)
  ) return 0;
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

  return Math.min(team.maxBid, strategyLimit, enforcedValueLimit);
};
