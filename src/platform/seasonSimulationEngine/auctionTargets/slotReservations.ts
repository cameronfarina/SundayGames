import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../../genericAuctionMockEngine.js";
import { canFitTargetPositions, positionsStayWithinMaximums } from "./slotMatching.js";

const positionCountsWith = (
  team: GenericAuctionMockTeamReadModel,
  players: readonly GenericAuctionMockBoardPlayer[],
): Record<string, number> => {
  const projectedPositionCounts = { ...team.positionCounts };
  for (const player of players) {
    projectedPositionCounts[player.position]
      = (projectedPositionCounts[player.position] ?? 0) + 1;
  }
  return projectedPositionCounts;
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

  const projectedPositionCounts = positionCountsWith(team, [player, ...targetPlayers]);
  if (!positionsStayWithinMaximums(
    projectedPositionCounts,
    state.configuration.positionMaximums,
  )) return false;

  const remainingSlots = team.slots.filter((slot, index) =>
    index !== playerSlotIndex && slot.playerId === undefined
  );
  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    remainingSlots,
  );
};

export const canReserveTargetsForTeam = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  targetPlayers: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const projectedPositionCounts = positionCountsWith(team, targetPlayers);
  if (!positionsStayWithinMaximums(
    projectedPositionCounts,
    state.configuration.positionMaximums,
  )) return false;

  return canFitTargetPositions(
    targetPlayers.map(targetPlayer => targetPlayer.position),
    team.slots.filter(slot => slot.playerId === undefined),
  );
};
