import { SimulationError, type SimulationRun } from "../simulations.js";
import { findById, findRequired } from "./lookups.js";
import { runFromRow } from "./runCodec.js";
import { firstRow, type SimulationRepositoryContext, type SimulationRunRow } from "./types.js";

export const markRunning = async (
  context: SimulationRepositoryContext,
  runId: string,
  now: Date,
): Promise<SimulationRun> => {
  const result = await context.client.query<SimulationRunRow>(`
UPDATE simulation_runs
SET status = 'running',
    started_at = $2,
    updated_at = $2
WHERE id = $1
  AND status IN ('requested', 'failed')
RETURNING *, NULL::text AS result_id, NULL::jsonb AS summary_json,
  NULL::jsonb AS result_set_json, NULL::timestamptz AS result_created_at;
`.trim(), [runId, now]);
  const row = firstRow(result);
  return row === undefined ? await findRequired(runId, context.client) : runFromRow(row);
};

export const markFailed = async (
  context: SimulationRepositoryContext,
  runId: string,
): Promise<SimulationRun> => {
  const existingRun = await findById(runId, context.client);
  if (existingRun === null) {
    throw new SimulationError("simulation_not_found", "Simulation run was not found.");
  }
  if (existingRun.status !== "requested" && existingRun.status !== "running") return existingRun;
  const now = new Date();
  await context.client.query(
    `UPDATE simulation_runs SET status = 'failed', updated_at = $2
WHERE id = $1 AND status IN ('requested', 'running')`,
    [runId, now],
  );
  return await findRequired(runId, context.client);
};
