import { resultWithOutcomeFavorite } from "../simulations/outcomeFavorites.js";
import type { SimulationRun } from "../simulations.js";
import { jsonbParameter } from "./json.js";
import { findById, findRequired } from "./lookups.js";
import type { SimulationRepositoryContext } from "./types.js";

export const setOutcomeFavorite = async (
  context: SimulationRepositoryContext,
  runId: string,
  runNumber: number,
  favorite: boolean,
): Promise<SimulationRun> => await context.client.transaction(async client => {
  const run = await findById(runId, client);
  const result = resultWithOutcomeFavorite(run?.result, runNumber, favorite);
  await client.query(
    "UPDATE simulation_results SET result_set_json = $2::jsonb WHERE simulation_run_id = $1",
    [runId, jsonbParameter(result)],
  );
  return await findRequired(runId, client);
});
