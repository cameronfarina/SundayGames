import type { RunSeasonSimulationsInput } from "./contracts.js";
import {
  maximumSeasonSimulationRunCount,
  SeasonSimulationError,
} from "./contracts.js";

export const validateSeasonSimulationInput = (
  input: RunSeasonSimulationsInput,
): void => {
  if (
    !Number.isInteger(input.runCount)
    || input.runCount < 1
    || input.runCount > maximumSeasonSimulationRunCount
  ) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      `Simulation run count must be a whole number from 1 through ${maximumSeasonSimulationRunCount}.`,
    );
  }
  if ((input.seedPrefix ?? "season-simulation").trim().length === 0) {
    throw new SeasonSimulationError("invalid_seed_prefix", "Simulation seed prefix is required.");
  }
  if (!input.season.teams.some(team => team.id === input.humanTeamId)) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  if (input.setup.seasonId !== input.season.id) {
    throw new SeasonSimulationError(
      "invalid_configuration",
      "Simulation setup does not belong to the selected league season.",
    );
  }
};
