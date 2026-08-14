import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../../genericAuctionMockEngine.js";

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
