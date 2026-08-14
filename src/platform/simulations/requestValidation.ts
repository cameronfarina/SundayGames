import { maximumSimulationIdentifierLength } from "../simulationLimits.js";
import { SimulationError } from "./errors.js";
import type { CreateSimulationRequestInput } from "./runContracts.js";

export const maxSimulationCount = 100;

const assertRequestIdentifier = (label: string, value: string): void => {
  if (value.trim().length === 0) {
    throw new SimulationError("invalid_simulation_identifier", `Simulation ${label} is required.`);
  }
  if (value.length > maximumSimulationIdentifierLength) {
    throw new SimulationError(
      "invalid_simulation_identifier",
      `Simulation ${label} cannot exceed ${maximumSimulationIdentifierLength} characters.`,
    );
  }
};

export const assertSimulationRequestIdentifiers = (
  input: Pick<CreateSimulationRequestInput, "seedPrefix" | "idempotencyKey">,
): void => {
  assertRequestIdentifier("seed prefix", input.seedPrefix);
  assertRequestIdentifier("idempotency key", input.idempotencyKey);
};

export const assertSimulationCount = (count: number): void => {
  if (!Number.isInteger(count) || count < 1) {
    throw new SimulationError("invalid_count", "Simulation count must be at least 1.");
  }
  if (count > maxSimulationCount) {
    throw new SimulationError("invalid_count", `Simulation count cannot exceed ${maxSimulationCount}.`);
  }
};
