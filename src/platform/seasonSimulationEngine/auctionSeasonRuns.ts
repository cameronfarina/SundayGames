import { buildSeasonAuctionMockConfig } from "../seasonAuctionMock.js";
import { reconciledSeasonSimulationTeams } from "../seasonSimulationAuctionBudgets.js";
import type {
  CompletedSimulationRun,
  RunSeasonSimulationsInput,
  RunSeasonSimulationsOptions,
} from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";
import type { PreparedSeasonSimulation } from "./preparation.js";
import { runAuctionSimulation } from "./auctionRunner.js";
import { isStarterSlot, teamResultFor, week1PointsFor } from "./rosterResults.js";

export const runAuctionSeasonSimulations = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions,
  prepared: PreparedSeasonSimulation,
): readonly CompletedSimulationRun[] => {
  const runs: CompletedSimulationRun[] = [];
  for (let runNumber = 1; runNumber <= input.runCount; runNumber += 1) {
    const seed = `${prepared.seedPrefix}:${runNumber}`;
    const config = buildSeasonAuctionMockConfig({
      season: input.season,
      setup: input.setup,
      humanTeamId: input.humanTeamId,
      sessionId: `${prepared.seedPrefix}-auction-${runNumber}`,
      seed,
      playerExpectedPrices: input.playerExpectedPrices,
      playerHumanValues: input.playerHumanValues,
    });
    const state = runAuctionSimulation({
      config: { ...config, plannedAcquisitions: prepared.targetPlan.plannedAcquisitions },
      strategy: prepared.strategyResolution.strategy,
      preferences: prepared.preferenceResolution.preferences,
      targetsByPlayerId: prepared.targetsByPlayerId,
      pairPlayerId: prepared.strategyResolution.pairPlayerId,
      seed,
    });
    if (!state.teams.some(team => team.id === input.humanTeamId)) {
      throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
    }
    const reconciledTeams = reconciledSeasonSimulationTeams({
      state,
      targetsByPlayerId: prepared.targetsByPlayerId,
      positionCaps: prepared.strategyResolution.strategy.positionCaps ?? [],
    });
    runs.push({
      runNumber,
      seed,
      teams: reconciledTeams.map(team => teamResultFor({
        teamId: team.id,
        teamName: team.name,
        isUserTeam: team.id === input.humanTeamId,
        spent: team.spent,
        budgetRemaining: team.budgetRemaining,
        roster: team.roster.map(player => ({
          playerId: player.playerId,
          playerName: player.playerName,
          position: player.position,
          source: player.source,
          price: player.price,
          rosterSlot: player.rosterSlot,
          starter: isStarterSlot(player.rosterSlot),
          week1Points: week1PointsFor(
            prepared.week1ProjectionsByPlayer,
            player.playerId,
          ),
        })),
      }, team.slots)),
    });
    options.onProgress?.({ completed: runNumber, total: input.runCount });
  }
  return runs;
};
