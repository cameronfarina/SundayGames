import { GenericAuctionMockError } from "../genericAuctionMockEngine.js";
import { SeasonAuctionMockError } from "../seasonAuctionMock.js";
import { SeasonSnakeMockError } from "../seasonSnakeMock.js";
import { SnakeDraftError } from "../snakeDraftEngine.js";
import { aggregateRuns } from "./aggregateRuns.js";
import { runAuctionSeasonSimulations } from "./auctionSeasonRuns.js";
import type {
  RunSeasonSimulationsInput,
  RunSeasonSimulationsOptions,
  SeasonSimulationResult,
} from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";
import { prepareSeasonSimulation } from "./preparation.js";
import { runSnakeSeasonSimulations } from "./snakeSeasonRuns.js";

const runSeasonSimulationsUnchecked = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions,
): SeasonSimulationResult => {
  const prepared = prepareSeasonSimulation(input);
  const runs = prepared.draftFormat === "snake"
    ? runSnakeSeasonSimulations(input, options, prepared)
    : runAuctionSeasonSimulations(input, options, prepared);
  return aggregateRuns({
    draftFormat: prepared.draftFormat,
    runs,
    runCount: input.runCount,
    seedPrefix: prepared.seedPrefix,
    strategy: prepared.strategyResolution.strategy,
    resolvedTargets: prepared.strategyResolution.resolvedTargets,
    preferences: prepared.preferenceResolution.preferences,
    pairPlayerId: prepared.strategyResolution.pairPlayerId,
    humanTeamId: input.humanTeamId,
  });
};

export const runSeasonSimulations = (
  input: RunSeasonSimulationsInput,
  options: RunSeasonSimulationsOptions = {},
): SeasonSimulationResult => {
  try {
    return runSeasonSimulationsUnchecked(input, options);
  } catch (error) {
    if (error instanceof SeasonSimulationError) throw error;
    if (
      error instanceof SeasonAuctionMockError
      || error instanceof SeasonSnakeMockError
      || error instanceof GenericAuctionMockError
      || error instanceof SnakeDraftError
    ) {
      throw new SeasonSimulationError("invalid_configuration", error.message);
    }
    throw error;
  }
};
