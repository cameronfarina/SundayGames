import type { JobRecord, JsonObject, JsonValue } from "./jobs.js";

const simulationExecutionType = "simulation-run-execution";

const isSimulationJobInput = (value: JsonValue): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const simulationRunIdForJob = (job: JobRecord): string | undefined => {
  if (job.kind !== "simulation" || !isSimulationJobInput(job.inputJson)) return undefined;
  if (job.inputJson.type !== simulationExecutionType) return undefined;

  return typeof job.inputJson.simulationRunId === "string"
    ? job.inputJson.simulationRunId
    : undefined;
};

export const simulationRerunIdempotencyKey = (simulationRunId: string): string =>
  `simulation-rerun:${simulationRunId}`;
