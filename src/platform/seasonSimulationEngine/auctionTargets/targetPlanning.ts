import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../../genericAuctionMockEngine.js";
import type { SeasonSimulationTargetConstraint } from "../../seasonSimulationTargets.js";
import { canAuctionTeamAcquire } from "./acquisitionEligibility.js";
import { canReserveTargetsForTeam, preservesSlotsForTargets } from "./slotReservations.js";

const availableTargetPlayersFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  currentPlayerId: string,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): readonly GenericAuctionMockBoardPlayer[] => [...targetsByPlayerId.keys()]
  .filter(playerId => playerId !== currentPlayerId)
  .map(playerId => state.board.players.find(player => player.id === playerId))
  .filter((player): player is GenericAuctionMockBoardPlayer =>
    player !== undefined && canAuctionTeamAcquire(state, team, player)
  );

export const minimumTargetAcquisitionCostFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): number => {
  const minimumBid = state.configuration.minimumBidDollars;
  const targetCap = targetsByPlayerId.get(player.id)?.maxAuctionPrice;
  const expectedClearingPrice = Math.max(minimumBid, Math.round(player.expectedPrice));
  return targetCap === undefined
    ? expectedClearingPrice
    : Math.min(targetCap, expectedClearingPrice);
};

export const plannedFutureTargetsFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
): readonly GenericAuctionMockBoardPlayer[] => {
  const minimumBid = state.configuration.minimumBidDollars;
  const nomination = state.session.currentNomination;
  const candidateIsTarget = targetsByPlayerId.has(player.id);
  const currentBid = nomination?.playerId === player.id ? nomination.nextBid : minimumBid;
  const candidateCost = candidateIsTarget ? currentBid : 0;
  const candidateSlots = candidateIsTarget ? 1 : 0;
  const availableTargets = availableTargetPlayersFor(state, team, player.id, targetsByPlayerId);
  const plannedTargets: GenericAuctionMockBoardPlayer[] = [];
  let plannedTargetCost = 0;

  for (const targetPlayer of availableTargets) {
    if (plannedTargets.length >= team.rosterSlotsRemaining - candidateSlots) break;
    const nextTargets = [...plannedTargets, targetPlayer];
    const targetsFit = candidateIsTarget
      ? preservesSlotsForTargets(state, team, player, nextTargets)
      : canReserveTargetsForTeam(state, team, nextTargets);
    if (!targetsFit) continue;

    const nextTargetCost = minimumTargetAcquisitionCostFor(
      state,
      targetPlayer,
      targetsByPlayerId,
    );
    const unplannedSlots = team.rosterSlotsRemaining - nextTargets.length - candidateSlots;
    const minimumRosterCost = unplannedSlots * minimumBid;
    if (
      candidateCost + plannedTargetCost + nextTargetCost + minimumRosterCost
      > team.budgetRemaining
    ) continue;

    plannedTargets.push(targetPlayer);
    plannedTargetCost += nextTargetCost;
  }

  return plannedTargets;
};
