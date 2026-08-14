import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import { invalidWorkerMessage } from "./errors.js";
import { optionalNumberValue, recordValue, stringValue } from "./primitives.js";

const targetConstraintValue = (value: unknown): SeasonSimulationTargetConstraint => {
  const record = recordValue(value);
  const maxAuctionPrice = optionalNumberValue(record.maxAuctionPrice);
  const maxSnakeRound = optionalNumberValue(record.maxSnakeRound);
  const maxSnakeOverallPick = optionalNumberValue(record.maxSnakeOverallPick);
  return {
    playerName: stringValue(record.playerName),
    ...(maxAuctionPrice === undefined ? {} : { maxAuctionPrice }),
    ...(maxSnakeRound === undefined ? {} : { maxSnakeRound }),
    ...(maxSnakeOverallPick === undefined ? {} : { maxSnakeOverallPick }),
  };
};

export const targetConstraintsValue = (
  value: unknown,
): readonly SeasonSimulationTargetConstraint[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return invalidWorkerMessage();
  return value.map(targetConstraintValue);
};
