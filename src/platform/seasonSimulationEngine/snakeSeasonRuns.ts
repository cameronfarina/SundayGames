import { buildSeasonSnakeMockConfig } from "../seasonSnakeMock.js";
import type {
  CompletedSimulationRun,
  RunSeasonSimulationsInput,
  RunSeasonSimulationsOptions,
} from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";
import type { PreparedSeasonSimulation } from "./preparation.js";
import { isStarterSlot, teamResultFor, week1PointsFor } from "./rosterResults.js";
import { runSnakeSimulation } from "./snakeRunner.js";

export const runSnakeSeasonSimulations = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions,
  prepared: PreparedSeasonSimulation,
): readonly CompletedSimulationRun[] => {
  const runs: CompletedSimulationRun[] = [];
  for (let runNumber = 1; runNumber <= input.runCount; runNumber += 1) {
    const seed = `${prepared.seedPrefix}:${runNumber}`;
    const config = buildSeasonSnakeMockConfig({
      season: input.season,
      setup: input.setup,
      humanTeamId: input.humanTeamId,
      sessionId: `${prepared.seedPrefix}-snake-${runNumber}`,
      seed,
    });
    const state = runSnakeSimulation({
      config,
      preferences: prepared.preferenceResolution.preferences,
      targetsByPlayerId: prepared.targetsByPlayerId,
      pairPlayerId: prepared.strategyResolution.pairPlayerId,
      seed,
    });
    if (!state.teams.some(team => team.id === input.humanTeamId)) {
      throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
    }
    runs.push({
      runNumber,
      seed,
      teams: state.teams.map(team => teamResultFor({
        teamId: team.id,
        teamName: team.name,
        isUserTeam: team.id === input.humanTeamId,
        roster: team.roster.map(selection => {
          const player = state.configuration.players.find(
            candidate => candidate.id === selection.playerId,
          );
          const pick = state.board.picks.find(candidate =>
            candidate.teamId === team.id
            && candidate.selection?.playerId === selection.playerId
          );
          if (player === undefined || pick === undefined) {
            throw new SeasonSimulationError(
              "simulation_failed",
              "A completed snake roster could not be mapped back to its player catalog and pick.",
            );
          }
          return {
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            source: selection.source,
            overallPick: pick.overall,
            round: pick.round,
            rosterSlot: selection.rosterSlot,
            starter: isStarterSlot(selection.rosterSlot),
            week1Points: week1PointsFor(prepared.week1ProjectionsByPlayer, player.id),
          };
        }),
      }, team.slots)),
    });
    options.onProgress?.({ completed: runNumber, total: input.runCount });
  }
  return runs;
};
