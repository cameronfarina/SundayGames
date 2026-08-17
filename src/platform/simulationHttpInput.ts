import {
  maximumSimulationCandidatePoolSize,
  maximumSimulationHardLocks,
  maximumSimulationNoteLength,
  maximumSimulationSoftTargets,
  maximumSimulationStrategyTextLength,
} from "./simulationLimits.js";
import {
  SimulationError,
  type SimulationHardLockInput,
  type SimulationSoftTargetInput,
  type SimulationStrategyInput,
} from "./simulations.js";

const invalidStrategy = (message: string): never => {
  throw new SimulationError("invalid_simulation_strategy", message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const recordValue = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    return invalidStrategy("Simulation strategy must be an object.");
  }
  return value;
};

const strategyArray = (
  value: unknown,
  maximum: number,
  message: string,
): readonly unknown[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return invalidStrategy("Simulation strategy must use hardLocks and softTargets arrays.");
  }
  if (value.length > maximum) {
    throw new SimulationError("simulation_strategy_too_large", message);
  }
  return value;
};

const hardLockFromUnknown = (value: unknown): SimulationHardLockInput => {
  const record = recordValue(value);
  if (typeof record.playerName !== "string" || typeof record.price !== "number") {
    return invalidStrategy("Each hard lock must include a player name and numeric price.");
  }
  const priceMode = record.priceMode;
  if (priceMode !== undefined && priceMode !== "exact" && priceMode !== "ceiling") {
    return invalidStrategy("Hard-lock priceMode must be exact or ceiling.");
  }
  const auctionOwner = typeof record.auctionOwner === "string"
    ? record.auctionOwner.trim()
    : undefined;
  if (record.auctionOwner !== undefined && (auctionOwner === undefined || auctionOwner.length === 0)) {
    return invalidStrategy("Hard-lock auctionOwner must name a team manager.");
  }
  return {
    playerName: record.playerName,
    price: record.price,
    ...(priceMode === undefined ? {} : { priceMode }),
    ...(auctionOwner === undefined ? {} : { auctionOwner }),
  };
};

const softTargetFromUnknown = (value: unknown): SimulationSoftTargetInput => {
  const record = recordValue(value);
  if (
    typeof record.label !== "string"
    || typeof record.maxBid !== "number"
    || !Array.isArray(record.candidatePool)
  ) {
    return invalidStrategy("Each soft target must include a label, candidate pool, and numeric max bid.");
  }
  if (record.candidatePool.length > maximumSimulationCandidatePoolSize) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `A soft target cannot contain more than ${maximumSimulationCandidatePoolSize} candidates.`,
    );
  }
  const candidatePool = record.candidatePool.flatMap(candidate => {
    if (typeof candidate !== "string") {
      return invalidStrategy("Each soft-target candidate must be a player name.");
    }
    return [candidate];
  });
  return { label: record.label, candidatePool, maxBid: record.maxBid };
};

export const simulationStrategyInputFromUnknown = (value: unknown): SimulationStrategyInput => {
  if (value === undefined) return {};
  const record = recordValue(value);
  const hardLocks = strategyArray(
    record.hardLocks,
    maximumSimulationHardLocks,
    `Simulation strategy cannot contain more than ${maximumSimulationHardLocks} hard locks.`,
  ).map(hardLockFromUnknown);
  const softTargets = strategyArray(
    record.softTargets,
    maximumSimulationSoftTargets,
    `Simulation strategy cannot contain more than ${maximumSimulationSoftTargets} soft targets.`,
  ).map(softTargetFromUnknown);
  return { hardLocks, softTargets };
};

const boundedText = (
  value: unknown,
  label: string,
  maximum: number,
): string => {
  if (value === undefined) return "";
  if (typeof value !== "string") return invalidStrategy(`${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `${label} cannot exceed ${maximum} characters.`,
    );
  }
  return normalized;
};

export const seasonSimulationTextInputFromUnknown = (
  input: Record<string, unknown>,
): { strategy: string; note?: string | undefined } => {
  const strategy = boundedText(
    input.strategy,
    "Simulation strategy text",
    maximumSimulationStrategyTextLength,
  );
  const note = boundedText(input.note, "Simulation note", maximumSimulationNoteLength);
  return { strategy, ...(note.length === 0 ? {} : { note }) };
};
