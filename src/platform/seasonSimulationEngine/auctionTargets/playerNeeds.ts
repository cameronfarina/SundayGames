import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockTeamReadModel,
} from "../../genericAuctionMockEngine.js";

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
