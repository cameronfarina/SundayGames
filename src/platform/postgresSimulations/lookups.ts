import { SimulationError, type SimulationRun } from "../simulations.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { runFromRow } from "./runCodec.js";
import { selectSimulationWithResultSql } from "./sql.js";
import { firstRow, type SimulationRunRow } from "./types.js";

export const findById = async (
  runId: string,
  client: PostgresQueryClient,
): Promise<SimulationRun | null> => {
  const result = await client.query<SimulationRunRow>(
    `${selectSimulationWithResultSql} WHERE r.id = $1`,
    [runId],
  );
  const row = firstRow(result);
  return row === undefined ? null : runFromRow(row);
};

export const findRequired = async (
  runId: string,
  client: PostgresQueryClient,
): Promise<SimulationRun> => {
  const run = await findById(runId, client);
  if (run === null) {
    throw new SimulationError("simulation_not_found", "Simulation run was not found.");
  }
  return run;
};

export interface FindByIdempotencyInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  idempotencyKey: string;
}

export const findByIdempotency = async (
  input: FindByIdempotencyInput,
  client: PostgresQueryClient,
): Promise<SimulationRun | null> => {
  const result = await client.query<SimulationRunRow>(`
${selectSimulationWithResultSql}
WHERE r.user_id = $1
  AND r.league_id = $2
  AND r.league_season_id = $3
  AND r.idempotency_key = $4
`.trim(), [input.userId, input.leagueId, input.seasonId, input.idempotencyKey]);
  const row = firstRow(result);
  return row === undefined ? null : runFromRow(row);
};

export const findByRequestKeyForUser = async (
  userId: string,
  seasonId: string,
  idempotencyKey: string,
  client: PostgresQueryClient,
): Promise<SimulationRun | null> => {
  const result = await client.query<SimulationRunRow>(`
${selectSimulationWithResultSql}
WHERE r.user_id = $1
  AND r.league_season_id = $2
  AND r.idempotency_key = $3
`.trim(), [userId, seasonId, idempotencyKey]);
  const row = firstRow(result);
  return row === undefined ? null : runFromRow(row);
};
