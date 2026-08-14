import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import { assembleStrategy } from "./strategyParser/assembleStrategy.js";
import { createStrategyAccumulator } from "./strategyParser/contracts.js";
import { parseAuctionTargets } from "./strategyParser/parseAuctionTargets.js";
import { parseNamedTargets } from "./strategyParser/parseNamedTargets.js";
import { parsePairing } from "./strategyParser/parsePairing.js";
import { parsePositionCaps } from "./strategyParser/parsePositionCaps.js";
import {
  parseCountedPositionPreference,
  parseSinglePositionPreferences,
} from "./strategyParser/parsePositionPreferences.js";
import { parseSnakeTargets } from "./strategyParser/parseSnakeTargets.js";

export const parseSeasonSimulationStrategy = (
  rawInput: string,
): ParsedSeasonSimulationStrategy => {
  const accumulator = createStrategyAccumulator();
  let remainder = parseCountedPositionPreference(rawInput, accumulator.preferredPositions);
  remainder = parsePositionCaps(remainder, accumulator.positionCaps);
  remainder = parseAuctionTargets(remainder, accumulator.targetCandidates);
  remainder = parseSnakeTargets(remainder, accumulator.targetCandidates);
  remainder = parseSinglePositionPreferences(remainder, accumulator.preferredPositions);
  const pairing = parsePairing(remainder);
  remainder = parseNamedTargets(pairing.remainder, accumulator.targetCandidates);

  return assembleStrategy({
    rawInput,
    remainder,
    accumulator,
    pairWithPlayerName: pairing.playerName,
  });
};
