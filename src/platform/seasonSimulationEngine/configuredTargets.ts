import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import { targetsFor } from "./auctionTargets.js";
import { summaryFor } from "./strategySupport.js";

export const withConfiguredTargets = (
  strategy: ParsedSeasonSimulationStrategy,
  configuredTargets: readonly SeasonSimulationTargetConstraint[],
): ParsedSeasonSimulationStrategy => {
  if (configuredTargets.length === 0) return strategy;

  const normalizedConfiguredTargets = configuredTargets
    .map(target => ({ ...target, playerName: target.playerName.trim() }))
    .filter(target => target.playerName.length > 0);
  const targets = [
    ...normalizedConfiguredTargets,
    ...targetsFor(strategy),
  ];
  const target = targets[0];

  return {
    ...strategy,
    targets,
    ...(target === undefined ? {} : { target }),
    summary: summaryFor(
      targets,
      strategy.preferredPositions,
      strategy.positionCaps ?? [],
      strategy.pairWithPlayerName,
    ),
  };
};
