import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
} from "../seasonAuctionMock.js";
import { resolveSeasonSimulationPreferences } from "../seasonSimulationPreferences.js";
import { resolveAuctionTargetPlan } from "../seasonSimulationTargetPlan.js";
import type { RunSeasonSimulationsInput } from "./contracts.js";
import { SeasonSimulationError } from "./contracts.js";
import { defaultSeedPrefix } from "./constants.js";
import { withConfiguredTargets } from "./configuredTargets.js";
import { resolvedStrategy } from "./strategyResolution.js";
import { parseSeasonSimulationStrategy } from "./strategyParser.js";
import { targetsFor } from "./auctionTargets.js";
import { validateSeasonSimulationInput } from "./validation.js";

export const prepareSeasonSimulation = (input: RunSeasonSimulationsInput) => {
  validateSeasonSimulationInput(input);
  const seedPrefix = input.seedPrefix ?? defaultSeedPrefix;
  const parsedStrategy = withConfiguredTargets(
    parseSeasonSimulationStrategy(input.strategyInput ?? ""),
    input.targetConstraints ?? [],
  );
  const week1ProjectionsByPlayer = new Map(input.setup.playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [playerKey, input.week1Projections?.[playerKey] ?? player.week1Projection ?? 0];
  }));
  const formatWarnings = [...parsedStrategy.warnings];
  if (
    input.season.settings.draftFormat === "auction"
    && targetsFor(parsedStrategy).some(target =>
      target.maxSnakeRound !== undefined || target.maxSnakeOverallPick !== undefined
    )
  ) {
    formatWarnings.push(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
  }
  if (
    input.season.settings.draftFormat === "snake"
    && targetsFor(parsedStrategy).some(target => target.maxAuctionPrice !== undefined)
  ) {
    formatWarnings.push(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  }
  const baseStrategyResolution = resolvedStrategy(
    { ...parsedStrategy, warnings: formatWarnings },
    input.setup,
    input.humanTeamId,
    input.season.teams,
    input.season.settings.draftFormat,
  );
  const targetPlan = input.season.settings.draftFormat === "auction"
    ? resolveAuctionTargetPlan({
      state: replaySeasonAuctionMockCommands(buildSeasonAuctionMockConfig({
        season: input.season,
        setup: input.setup,
        humanTeamId: input.humanTeamId,
        sessionId: `${seedPrefix}-target-plan`,
        seed: `${seedPrefix}:target-plan`,
        playerExpectedPrices: input.playerExpectedPrices,
        playerHumanValues: input.playerHumanValues,
        historicalSaleRecords: input.historicalSaleRecords,
      }), []),
      humanTeamId: input.humanTeamId,
      targets: baseStrategyResolution.resolvedTargets,
    })
    : { targets: baseStrategyResolution.resolvedTargets, plannedAcquisitions: [] };
  const targetPlanWarnings = targetPlan.targets
    .map(target => target.infeasibility?.message)
    .filter((message): message is string =>
      message !== undefined && !baseStrategyResolution.strategy.warnings.includes(message)
    );
  const preferenceResolution = resolveSeasonSimulationPreferences({
    preferences: baseStrategyResolution.strategy.preferredPositions,
    season: input.season,
    setup: input.setup,
    humanTeamId: input.humanTeamId,
    pairPlayerId: baseStrategyResolution.pairPlayerId,
    playerExpectedPrices: input.playerExpectedPrices,
  });
  const strategyResolution = {
    ...baseStrategyResolution,
    resolvedTargets: targetPlan.targets,
    strategy: {
      ...baseStrategyResolution.strategy,
      warnings: [
        ...baseStrategyResolution.strategy.warnings,
        ...targetPlanWarnings,
        ...preferenceResolution.warnings,
      ],
    },
  };
  const targetsByPlayerId = new Map(strategyResolution.resolvedTargets
    .filter(target => target.infeasibility === undefined)
    .map(({ playerId, target }) => [playerId, target]));
  const draftFormat = input.season.settings.draftFormat;
  if (draftFormat !== "auction" && draftFormat !== "snake") {
    throw new SeasonSimulationError(
      "invalid_configuration",
      "Simulation season must explicitly use auction or snake draft settings.",
    );
  }
  return {
    draftFormat,
    seedPrefix,
    strategyResolution,
    preferenceResolution,
    targetsByPlayerId,
    targetPlan,
    week1ProjectionsByPlayer,
  };
};

export type PreparedSeasonSimulation = ReturnType<typeof prepareSeasonSimulation>;
