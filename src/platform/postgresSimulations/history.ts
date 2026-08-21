import type { SimulationRun } from "../simulations.js";
import {
  boundedSimulationHistoryPageSize,
  maximumRetainedSimulationRunsPerUser,
} from "../simulationLimits.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { runFromRow } from "./runCodec.js";
import {
  selectSimulationHistorySql,
  selectSimulationWithoutResultSql,
  selectSimulationWithResultSql,
} from "./sql.js";
import { firstRow, type SimulationRunRow } from "./types.js";

export const listForUser = async (
  client: PostgresQueryClient,
  userId: string,
  limit = maximumRetainedSimulationRunsPerUser,
): Promise<SimulationRun[]> => {
  const result = await client.query<SimulationRunRow>(
    `${selectSimulationWithoutResultSql}
WHERE r.user_id = $1
ORDER BY r.created_at DESC, r.id DESC
LIMIT $2`,
    [userId, boundedSimulationHistoryPageSize(limit)],
  );
  return result.rows.map(runFromRow);
};

export const listHistoryForUserSeason = async (
  client: PostgresQueryClient,
  userId: string,
  seasonId: string,
  limit: number,
): Promise<SimulationRun[]> => {
  const result = await client.query<SimulationRunRow>(
    `${selectSimulationHistorySql}
WHERE r.user_id = $1 AND r.league_season_id = $2 AND r.status = 'completed'
ORDER BY r.completed_at DESC, r.id DESC
LIMIT $3`,
    [userId, seasonId, boundedSimulationHistoryPageSize(limit)],
  );
  return result.rows.map(runFromRow);
};

export const fetchForUser = async (
  client: PostgresQueryClient,
  runId: string,
  userId: string,
): Promise<SimulationRun | null> => {
  const result = await client.query<SimulationRunRow>(
    `${selectSimulationWithResultSql} WHERE r.id = $1 AND r.user_id = $2`,
    [runId, userId],
  );
  const row = firstRow(result);
  return row === undefined ? null : runFromRow(row);
};
