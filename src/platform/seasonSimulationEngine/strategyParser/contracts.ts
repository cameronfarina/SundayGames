import type { SeasonSimulationPreferredPosition } from "../../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../../seasonSimulationTargets.js";
import type { SeasonSimulationPositionCap } from "../contracts.js";

export type StrategicPosition = "QB" | "RB" | "WR" | "TE";

export interface TargetCandidate {
  index: number;
  target: SeasonSimulationTargetConstraint;
}

export interface StrategyAccumulator {
  targetCandidates: TargetCandidate[];
  preferredPositions: SeasonSimulationPreferredPosition[];
  positionCaps: SeasonSimulationPositionCap[];
}

export interface PairingParseResult {
  remainder: string;
  playerName: string | undefined;
}

export const createStrategyAccumulator = (): StrategyAccumulator => ({
  targetCandidates: [],
  preferredPositions: [],
  positionCaps: [],
});

export const strategicPositionFor = (
  value: string | undefined,
): StrategicPosition | undefined => {
  const position = value?.toUpperCase();
  if (position === "QB" || position === "RB" || position === "WR" || position === "TE") {
    return position;
  }
  return undefined;
};
