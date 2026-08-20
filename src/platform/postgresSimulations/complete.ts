import {
  SimulationError,
  createSimulationResultId,
  type SimulationResult,
  type SimulationRun,
} from "../simulations.js";
import { jsonbParameter } from "./json.js";
import { findById, findRequired } from "./lookups.js";
import type { SimulationRepositoryContext } from "./types.js";

export const complete = async (
  context: SimulationRepositoryContext,
  runId: string,
  result: SimulationResult,
  executionStartedAt?: Date,
): Promise<SimulationRun> => await context.client.transaction(async client => {
  const existingRun = await findById(runId, client);
  if (existingRun === null) {
    throw new SimulationError("simulation_not_found", "Simulation run was not found.");
  }
  if (existingRun.status === "canceled") return existingRun;
  const completion = await client.query<{ id: string }>(`
UPDATE simulation_runs
SET status = 'completed',
    completed_at = $2,
    updated_at = $2
WHERE id = $1
  AND ($3::timestamptz IS NULL OR started_at = $3)
RETURNING id
`.trim(), [runId, result.completedAt, executionStartedAt ?? null]);
  if (completion.rows.length === 0) {
    throw new SimulationError(
      "simulation_execution_superseded",
      "Simulation completion was superseded by a newer execution.",
    );
  }
  await client.query(`
INSERT INTO simulation_results (
  id, simulation_run_id, summary_json, result_set_json, created_at
) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
ON CONFLICT (simulation_run_id) DO UPDATE SET
  summary_json = EXCLUDED.summary_json,
  result_set_json = EXCLUDED.result_set_json
`.trim(), [
    createSimulationResultId(), runId, jsonbParameter(result.summary),
    jsonbParameter(result), result.completedAt,
  ]);
  return await findRequired(runId, client);
});
