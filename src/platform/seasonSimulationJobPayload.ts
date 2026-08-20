import type { JsonObject, JsonValue } from "./jobs.js";
import type { SeasonSimulationExecutionJobInput } from "./platformJobOrchestrator.js";
import type { RunSeasonSimulationsInput } from "./seasonSimulationEngine.js";
import { decodeSeasonSimulationWorkerMessage } from "./seasonSimulationWorkerThread/decodeMessage.js";

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object"
    && value !== null
    && Object.values(value).every(child => child === undefined || isJsonValue(child));
};

const isJsonObjectValue = (value: unknown): value is JsonObject =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every(child => child === undefined || isJsonValue(child));

const jsonObjectFrom = (value: unknown): JsonObject => {
  const serialized = JSON.stringify(value);
  const parsed: unknown = serialized === undefined ? undefined : JSON.parse(serialized);
  if (!isJsonObjectValue(parsed)) {
    throw new Error("Season simulation input could not be serialized as a job payload.");
  }
  return parsed;
};

export const encodeSeasonSimulationExecutionJobInput = (input: {
  simulationInput: RunSeasonSimulationsInput;
  strategyText: string;
  note?: string | undefined;
}): SeasonSimulationExecutionJobInput => ({
  input: jsonObjectFrom(input.simulationInput),
  strategyText: input.strategyText,
  ...(input.note === undefined ? {} : { note: input.note }),
});

export const decodeSeasonSimulationExecutionJobInput = (
  payload: SeasonSimulationExecutionJobInput,
): RunSeasonSimulationsInput => decodeSeasonSimulationWorkerMessage({ input: payload.input });
