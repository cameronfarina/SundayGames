import type { ParsedSeasonSimulationStrategy } from "../contracts.js";
import { summaryFor, unsupportedWarning } from "../strategySupport.js";
import type { StrategyAccumulator } from "./contracts.js";

interface AssembleStrategyInput {
  rawInput: string;
  remainder: string;
  accumulator: StrategyAccumulator;
  pairWithPlayerName: string | undefined;
}

export const assembleStrategy = (
  input: AssembleStrategyInput,
): ParsedSeasonSimulationStrategy => {
  const targets = input.accumulator.targetCandidates
    .sort((left, right) => left.index - right.index)
    .map(candidate => candidate.target);
  const target = targets[0];
  const warning = unsupportedWarning(input.remainder);
  const { preferredPositions, positionCaps } = input.accumulator;

  return {
    rawInput: input.rawInput,
    targets,
    ...(target === undefined ? {} : { target }),
    preferredPositions,
    ...(positionCaps.length === 0 ? {} : { positionCaps }),
    ...(input.pairWithPlayerName === undefined
      ? {}
      : { pairWithPlayerName: input.pairWithPlayerName }),
    summary: summaryFor(
      targets,
      preferredPositions,
      positionCaps,
      input.pairWithPlayerName,
    ),
    warnings: warning === undefined ? [] : [warning],
  };
};
