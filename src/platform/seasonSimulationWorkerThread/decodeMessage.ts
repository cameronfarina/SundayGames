import type { RunSeasonSimulationsInput } from "../seasonSimulationEngine.js";
import { seasonValue } from "../seasonMockSnapshot/decoding/season.js";
import { invalidWorkerMessage } from "./errors.js";
import {
  numberValue,
  optionalNumberRecord,
  optionalStringValue,
  recordValue,
  stringValue,
} from "./primitives.js";
import { setupValue } from "./setup.js";
import { targetConstraintsValue } from "./targetConstraints.js";

const decodeMessage = (value: unknown): RunSeasonSimulationsInput => {
  const message = recordValue(value);
  const input = recordValue(message.input);
  const strategyInput = optionalStringValue(input.strategyInput);
  const targetConstraints = targetConstraintsValue(input.targetConstraints);
  const seedPrefix = optionalStringValue(input.seedPrefix);
  const playerExpectedPrices = optionalNumberRecord(input.playerExpectedPrices);
  const playerHumanValues = optionalNumberRecord(input.playerHumanValues);
  const week1Projections = optionalNumberRecord(input.week1Projections);

  return {
    season: seasonValue(input.season),
    setup: setupValue(input.setup),
    humanTeamId: stringValue(input.humanTeamId),
    runCount: numberValue(input.runCount),
    ...(strategyInput === undefined ? {} : { strategyInput }),
    ...(targetConstraints === undefined ? {} : { targetConstraints }),
    ...(seedPrefix === undefined ? {} : { seedPrefix }),
    ...(playerExpectedPrices === undefined ? {} : { playerExpectedPrices }),
    ...(playerHumanValues === undefined ? {} : { playerHumanValues }),
    ...(week1Projections === undefined ? {} : { week1Projections }),
  };
};

export const decodeSeasonSimulationWorkerMessage = (
  value: unknown,
): RunSeasonSimulationsInput => {
  try {
    return decodeMessage(value);
  } catch {
    return invalidWorkerMessage();
  }
};
