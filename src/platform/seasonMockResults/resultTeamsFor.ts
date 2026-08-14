import type { GenericAuctionMockState } from "../genericAuctionMockEngine.js";
import type { SnakeDraftBoardPick, SnakeDraftState } from "../snakeDraftEngine.js";
import type { ResultTeamInput, SeasonMockState } from "./types.js";

const isAuctionState = (state: SeasonMockState): state is GenericAuctionMockState =>
  "sales" in state;

const selectedPickEntry = (
  pick: SnakeDraftBoardPick,
): readonly (readonly [string, number])[] => pick.selection === undefined
  ? []
  : [[pick.selection.playerId, pick.overall]];

const snakeResultTeams = (state: SnakeDraftState): readonly ResultTeamInput[] => {
  const pickByPlayerId = new Map(state.board.picks.flatMap(selectedPickEntry));
  return state.teams.map(team => ({
    id: team.id,
    name: team.name,
    slots: team.slots,
    acquisitions: team.roster.map(player => {
      const overallPick = pickByPlayerId.get(player.playerId);
      return {
        playerId: player.playerId,
        source: player.source,
        ...(overallPick === undefined ? {} : { overallPick }),
      };
    }),
  }));
};

export const resultTeamsFor = (state: SeasonMockState): readonly ResultTeamInput[] => {
  if (!isAuctionState(state)) return snakeResultTeams(state);
  return state.teams.map(team => ({
    id: team.id,
    name: team.name,
    slots: team.slots,
    acquisitions: team.roster.map(player => ({
      playerId: player.playerId,
      source: player.source,
      price: player.price,
    })),
    spent: team.spent,
    budgetRemaining: team.budgetRemaining,
  }));
};
