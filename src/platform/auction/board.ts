import type {
  GenericAuctionMockBoardReadModel,
  GenericAuctionMockPlayerStatus,
  GenericAuctionMockState,
} from "./types.js";

export const setBoardPlayerStatus = (
  state: GenericAuctionMockState,
  playerId: string,
  status: GenericAuctionMockPlayerStatus,
): GenericAuctionMockBoardReadModel => ({
  players: state.board.players.map(player => player.id === playerId ? {
    ...player,
    status,
    available: status === "available",
  } : player),
});
