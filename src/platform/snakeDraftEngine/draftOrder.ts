import type { SnakeDraftConfig } from "./config.js";
import { SnakeDraftError } from "./error.js";
import type { SnakeDraftBoardPick, SnakeDraftPickRef } from "./readModels.js";

export const isForwardRound = (round: number): boolean => round % 2 === 1;

export const buildPicks = (config: SnakeDraftConfig): SnakeDraftBoardPick[] => {
  const teamsById = new Map(config.teams.map(team => [team.id, team]));
  const picks: SnakeDraftBoardPick[] = [];

  for (let round = 1; round <= config.rounds; round += 1) {
    const roundOrder = isForwardRound(round)
      ? [...config.teamOrder]
      : [...config.teamOrder].reverse();

    roundOrder.forEach((teamId, index) => {
      const team = teamsById.get(teamId);
      if (team === undefined) {
        throw new SnakeDraftError("invalid_config", `Team order contains unknown team "${teamId}".`);
      }
      picks.push({
        overall: picks.length + 1,
        round,
        pickInRound: index + 1,
        teamId,
        teamName: team.name,
        selection: undefined,
      });
    });
  }

  return picks;
};

export const pickRefFor = (pick: SnakeDraftBoardPick): SnakeDraftPickRef => ({
  overall: pick.overall,
  round: pick.round,
  pickInRound: pick.pickInRound,
  teamId: pick.teamId,
});
