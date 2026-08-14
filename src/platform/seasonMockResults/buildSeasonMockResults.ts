import { buildResultTeam } from "./buildResultTeam.js";
import { resultTeamsFor } from "./resultTeamsFor.js";
import type {
  ResultBoardPlayer,
  SeasonMockResults,
  SeasonMockState,
} from "./types.js";

const playerMapFor = (state: SeasonMockState): ReadonlyMap<string, ResultBoardPlayer> => {
  const playersById = new Map<string, ResultBoardPlayer>();
  for (const player of state.board.players) playersById.set(player.id, player);
  return playersById;
};

export const buildSeasonMockResults = (state: SeasonMockState): SeasonMockResults => {
  const playersById = playerMapFor(state);
  const scoredTeams = resultTeamsFor(state).map(team =>
    buildResultTeam(team, state.session.humanTeamId, playersById)
  );
  const teams = scoredTeams
    .map(result => result.team)
    .sort((left, right) =>
      right.week1Points - left.week1Points || left.teamName.localeCompare(right.teamName)
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
  return {
    teams,
    projectedPlayerCount: scoredTeams.reduce(
      (total, result) => total + result.projectedPlayerCount,
      0,
    ),
    rosteredPlayerCount: scoredTeams.reduce(
      (total, result) => total + result.rosteredPlayerCount,
      0,
    ),
  };
};
