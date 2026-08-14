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
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import { humanClearingPriceCushionDollars } from "./constants.js";
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

  const isPair = player.id === pairPlayerId;
  const preference = activePositionPreferenceFor(
    preferences,
    team.roster,
    player,
    pairPlayerId,
  );
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
  const valueLimit = Math.max(
    state.configuration.minimumBidDollars,
    Math.round(baseValue) + needDollars + preferenceDollars + targetDollars,
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
  const minimumBid = state.configuration.minimumBidDollars;
  const discretionaryBudget = Math.max(
    0,
    team.budgetRemaining - team.rosterSlotsRemaining * minimumBid,
  );
  const closingPaceLimit = Math.min(
    team.maxBid,
    minimumBid
      + Math.ceil(discretionaryBudget / team.rosterSlotsRemaining)
      + humanClearingPriceCushionDollars,
  );
  let enforcedValueLimit = team.maxBid;
  if ((!isTarget || target.maxAuctionPrice !== undefined) && preference === undefined) {
    enforcedValueLimit = Math.max(valueLimit, closingPaceLimit);
  }

  return Math.min(team.maxBid, strategyLimit, enforcedValueLimit);
};
