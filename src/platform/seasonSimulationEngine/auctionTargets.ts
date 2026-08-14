import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../genericAuctionMockEngine.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";

export const auctionRosterNeedFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

export const auctionProjectedWeeklyProductionFor = (
  player: GenericAuctionMockBoardPlayer,
): number => player.week1Projection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection / 4)
  ?? (player.seasonProjection === undefined ? 0 : player.seasonProjection / 17);

export const needsDedicatedStarterFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): boolean => team.slots.some(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
);

export const targetsFor = (
  strategy: ParsedSeasonSimulationStrategy,
): readonly SeasonSimulationTargetConstraint[] => strategy.targets
  ?? (strategy.target === undefined ? [] : [strategy.target]);

export const canAuctionTeamRoster = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
): boolean => team.rosterSlotsRemaining > 0
  && team.maxBid >= state.configuration.minimumBidDollars
  && (team.positionCounts[player.position] ?? 0)
    < (state.configuration.positionMaximums[player.position] ?? 0)
  && team.slots.some(slot =>
    slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
  );

export const canAuctionTeamAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
): boolean => player.available && canAuctionTeamRoster(state, team, player);

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

const canFitTargetPositions = (
  positions: readonly string[],
  openSlots: GenericAuctionMockTeamReadModel["slots"],
): boolean => {
  const orderedPositions = [...positions].sort((left, right) => {
    const leftOptions = openSlots.filter(slot => slot.eligiblePositions.includes(left)).length;
    const rightOptions = openSlots.filter(slot => slot.eligiblePositions.includes(right)).length;
    return leftOptions - rightOptions;
  });
  const positionBySlotIndex = new Map<number, number>();
  const assign = (positionIndex: number, visitedSlotIndexes: Set<number>): boolean => {
    const position = orderedPositions[positionIndex];
    if (position === undefined) return false;
    for (const [slotIndex, slot] of openSlots.entries()) {
      if (visitedSlotIndexes.has(slotIndex) || !slot.eligiblePositions.includes(position)) continue;
      visitedSlotIndexes.add(slotIndex);
      const assignedPositionIndex = positionBySlotIndex.get(slotIndex);
      if (
        assignedPositionIndex === undefined
        || assign(assignedPositionIndex, visitedSlotIndexes)
      ) {
        positionBySlotIndex.set(slotIndex, positionIndex);
        return true;
      }
    }
    return false;
  };

  return orderedPositions.every((_, positionIndex) => assign(positionIndex, new Set()));
};

export const preservesSlotsForTargets = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockBoardPlayer,
  targetPlayers: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const playerSlotIndex = team.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) =>
      slot.playerId === undefined && slot.eligiblePositions.includes(player.position)
    )
    .sort((left, right) =>
      left.slot.eligiblePositions.length - right.slot.eligiblePositions.length
      || left.slot.slot.localeCompare(right.slot.slot)
    )[0]?.index;
  if (playerSlotIndex === undefined) return false;

  const projectedPositionCounts = { ...team.positionCounts };
  projectedPositionCounts[player.position] = (projectedPositionCounts[player.position] ?? 0) + 1;
  for (const targetPlayer of targetPlayers) {
    projectedPositionCounts[targetPlayer.position]
      = (projectedPositionCounts[targetPlayer.position] ?? 0) + 1;
  }
  if (Object.entries(projectedPositionCounts).some(([position, count]) =>
    count > (state.configuration.positionMaximums[position] ?? 0)
  )) return false;

  const remainingSlots = team.slots.filter((slot, index) =>
    index !== playerSlotIndex && slot.playerId === undefined
  );
  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    remainingSlots,
  );
};

const canReserveTargetsForTeam = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  targetPlayers: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const projectedPositionCounts = { ...team.positionCounts };
  for (const targetPlayer of targetPlayers) {
    projectedPositionCounts[targetPlayer.position]
      = (projectedPositionCounts[targetPlayer.position] ?? 0) + 1;
  }
  if (Object.entries(projectedPositionCounts).some(([position, count]) =>
    count > (state.configuration.positionMaximums[position] ?? 0)
  )) return false;

  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    team.slots.filter(slot => slot.playerId === undefined),
  );
};

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
  const availableTargets = availableTargetPlayersFor(
    state,
    team,
    player.id,
    targetsByPlayerId,
  );
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
