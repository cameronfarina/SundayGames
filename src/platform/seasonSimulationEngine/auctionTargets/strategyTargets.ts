import type { SeasonSimulationTargetConstraint } from "../../seasonSimulationTargets.js";
import type { ParsedSeasonSimulationStrategy } from "../contracts.js";

export const targetsFor = (
  strategy: ParsedSeasonSimulationStrategy,
): readonly SeasonSimulationTargetConstraint[] => strategy.targets
  ?? (strategy.target === undefined ? [] : [strategy.target]);
