import {
  maximumSimulationCandidatePoolSize,
  maximumSimulationSoftTargets,
} from "../simulationLimits.js";
import { SimulationError } from "./errors.js";
import { assertSimulationStrategyText } from "./strategyText.js";
import type { SimulationSoftTarget, SimulationSoftTargetInput } from "./strategyContracts.js";

export const normalizeSoftTargets = (
  softTargets: readonly SimulationSoftTargetInput[] = [],
): readonly SimulationSoftTarget[] => {
  if (softTargets.length > maximumSimulationSoftTargets) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `Simulation strategy cannot contain more than ${maximumSimulationSoftTargets} soft targets.`,
    );
  }

  return softTargets.map(softTarget => {
    if (softTarget.candidatePool.length > maximumSimulationCandidatePoolSize) {
      throw new SimulationError(
        "simulation_strategy_too_large",
        `A soft target cannot contain more than ${maximumSimulationCandidatePoolSize} candidates.`,
      );
    }
    const label = softTarget.label.trim();
    assertSimulationStrategyText(label);
    const candidatePool = softTarget.candidatePool
      .map(candidate => {
        const normalizedCandidate = candidate.trim();
        assertSimulationStrategyText(normalizedCandidate);
        return normalizedCandidate;
      })
      .filter(candidate => candidate.length > 0);

    if (label.length === 0) {
      throw new SimulationError("invalid_soft_target_label", "Soft targets must include a label.");
    }
    if (candidatePool.length === 0) {
      throw new SimulationError(
        "invalid_soft_target_candidate_pool",
        `Soft target ${label} must include at least one candidate.`,
      );
    }
    if (!Number.isInteger(softTarget.maxBid) || softTarget.maxBid < 1) {
      throw new SimulationError(
        "invalid_soft_target_max_bid",
        `Soft target ${label} must use a positive whole-dollar max bid.`,
      );
    }
    return { label, candidatePool, maxBid: softTarget.maxBid };
  });
};
