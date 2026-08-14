import type { Owner } from "../../config/league.js";
import {
  SimulationError,
  assertSimulationCount,
  assertSimulationRequestIdentifiers,
  createSimulationId,
  createSimulationRequestId,
  createSimulationResultId,
  hashSimulationInput,
  normalizeStrategy,
  simulationInputHashPayload,
  type CreateSimulationRequestInput,
  type SimulationHardLock,
  type SimulationRepository,
  type SimulationRequest,
  type SimulationResult,
  type SimulationRun,
  type SimulationRunStatus,
  type SimulationSoftTarget,
  type SimulationStrategy,
} from "./simulations.js";
import {
  boundedSimulationHistoryPageSize,
  maximumRetainedSimulationRunsPerUser,
} from "./simulationLimits.js";
import type {
  PostgresTransactionalQueryClient,
} from "./postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";

interface SimulationRunRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  job_id: string | null;
  model_run_id: string | null;
  pricing_snapshot_id: string | null;
  strategy_plan_version_id: string | null;
  owner_id: string;
  team_id: string;
  idempotency_key: string;
  input_hash: string;
  request_json: unknown;
  status: string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  result_id: string | null;
  summary_json: unknown;
  result_set_json: unknown;
  result_created_at: Date | string | null;
}

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const jsonValueFromDb = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;

  return JSON.parse(JSON.stringify(value)) as unknown;
};

const dateFromDb = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requiredDateFromDb = (field: string, value: Date | string): Date => {
  const date = dateFromDb(value);
  if (date === undefined) {
    throw new Error(`Postgres simulation row has invalid ${field}.`);
  }

  return date;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const stringFromRecord = (
  record: Record<string, unknown>,
  field: string,
  fallback: string,
): string => {
  const value = record[field];

  return typeof value === "string" ? value : fallback;
};

const numberFromRecord = (
  record: Record<string, unknown>,
  field: string,
  fallback: number,
): number => {
  const value = record[field];

  return typeof value === "number" ? value : fallback;
};

const hardLocksFromDb = (value: unknown): SimulationHardLock[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(hardLock => {
    if (!isRecord(hardLock)) return [];
    const playerName = hardLock.playerName;
    const price = hardLock.price;

    if (typeof playerName !== "string" || typeof price !== "number") return [];

    return [{
      playerName,
      price,
      priceMode: hardLock.priceMode === "ceiling" ? "ceiling" : "exact",
      auctionOwner: typeof hardLock.auctionOwner === "string" ? hardLock.auctionOwner as Owner : undefined,
    }];
  });
};

const softTargetsFromDb = (value: unknown): SimulationSoftTarget[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(softTarget => {
    if (!isRecord(softTarget)) return [];
    const label = softTarget.label;
    const maxBid = softTarget.maxBid;
    const candidatePool = softTarget.candidatePool;

    if (typeof label !== "string" || typeof maxBid !== "number" || !Array.isArray(candidatePool)) return [];

    return [{
      label,
      candidatePool: candidatePool.filter(candidate => typeof candidate === "string"),
      maxBid,
    }];
  });
};

const strategyFromDb = (value: unknown): SimulationStrategy => {
  if (!isRecord(value)) return { hardLocks: [], softTargets: [] };

  return {
    hardLocks: hardLocksFromDb(value.hardLocks),
    softTargets: softTargetsFromDb(value.softTargets),
  };
};

const requestFromRow = (row: SimulationRunRow): SimulationRequest => {
  const requestJson = jsonValueFromDb(row.request_json);
  const requestRecord = isRecord(requestJson) ? requestJson : {};
  const createdAt = requiredDateFromDb("created_at", row.created_at);

  return {
    id: stringFromRecord(requestRecord, "id", `simreq_${row.id}`),
    userId: row.user_id,
    leagueId: row.league_id,
    seasonId: row.league_season_id,
    ownerId: row.owner_id,
    teamId: row.team_id,
    count: numberFromRecord(requestRecord, "count", 1),
    seedPrefix: stringFromRecord(requestRecord, "seedPrefix", ""),
    idempotencyKey: row.idempotency_key,
    strategy: strategyFromDb(requestRecord.strategy),
    privacyOwnerUserId: row.user_id,
    inputHash: row.input_hash,
    createdAt,
  };
};

const resultFromRow = (row: SimulationRunRow): SimulationResult | undefined => {
  if (row.result_set_json === undefined || row.result_set_json === null) return undefined;
  const resultJson = jsonValueFromDb(row.result_set_json);
  if (!isRecord(resultJson)) return undefined;
  const request = requestFromRow(row);
  const completedAtValue = resultJson.completedAt;
  const completedAt = completedAtValue instanceof Date || typeof completedAtValue === "string"
    ? dateFromDb(completedAtValue)
    : dateFromDb(row.completed_at);

  return {
    runId: row.id,
    requestId: request.id,
    completedAt: completedAt ?? requiredDateFromDb("created_at", row.created_at),
    runCount: numberFromRecord(resultJson, "runCount", request.count),
    seedPrefix: stringFromRecord(resultJson, "seedPrefix", request.seedPrefix),
    hardLockCount: numberFromRecord(resultJson, "hardLockCount", request.strategy.hardLocks.length),
    softTargetCount: numberFromRecord(resultJson, "softTargetCount", request.strategy.softTargets.length),
    forcedSales: Array.isArray(resultJson.forcedSales)
      ? JSON.parse(JSON.stringify(resultJson.forcedSales)) as SimulationResult["forcedSales"]
      : [],
    summary: isRecord(resultJson.summary)
      ? JSON.parse(JSON.stringify(resultJson.summary)) as SimulationResult["summary"]
      : { runCount: request.count, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    ...(isRecord(resultJson.seasonSimulation)
      ? {
          seasonSimulation: JSON.parse(JSON.stringify(resultJson.seasonSimulation)) as NonNullable<
            SimulationResult["seasonSimulation"]
          >,
        }
      : {}),
    ...(typeof resultJson.strategyText === "string" ? { strategyText: resultJson.strategyText } : {}),
    ...(typeof resultJson.note === "string" ? { note: resultJson.note } : {}),
  };
};

const runFromRow = (row: SimulationRunRow): SimulationRun => {
  const request = requestFromRow(row);
  const completedAt = dateFromDb(row.completed_at);

  return {
    id: row.id,
    request,
    status: row.status as SimulationRunStatus,
    privacyOwnerUserId: row.user_id,
    createdAt: requiredDateFromDb("created_at", row.created_at),
    startedAt: dateFromDb(row.started_at),
    completedAt,
    result: resultFromRow(row),
  };
};

const selectSimulationWithResultSql = `
SELECT
  r.*,
  sr.id AS result_id,
  sr.summary_json,
  sr.result_set_json,
  sr.created_at AS result_created_at
FROM simulation_runs r
LEFT JOIN simulation_results sr ON sr.simulation_run_id = r.id
`.trim();

const selectSimulationWithoutResultSql = `
SELECT
  r.*,
  NULL::text AS result_id,
  NULL::jsonb AS summary_json,
  NULL::jsonb AS result_set_json,
  NULL::timestamptz AS result_created_at
FROM simulation_runs r
`.trim();

const selectSimulationHistorySql = `
SELECT
  r.*,
  sr.id AS result_id,
  sr.summary_json,
  CASE
    WHEN sr.result_set_json ? 'seasonSimulation'
      THEN jsonb_set(sr.result_set_json, '{seasonSimulation,runs}', '[]'::jsonb, false)
    ELSE sr.result_set_json
  END AS result_set_json,
  sr.created_at AS result_created_at
FROM simulation_runs r
LEFT JOIN simulation_results sr ON sr.simulation_run_id = r.id
`.trim();

export class PostgresSimulationRepository implements SimulationRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async createRequest(input: CreateSimulationRequestInput): Promise<SimulationRun> {
    const createdAt = input.createdAt ?? new Date();
    assertSimulationCount(input.count);
    assertSimulationRequestIdentifiers(input);
    const strategy = normalizeStrategy(input.strategy);
    const inputHash = hashSimulationInput(simulationInputHashPayload(input, strategy));
    const request: SimulationRequest = {
      id: createSimulationRequestId(),
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      count: input.count,
      seedPrefix: input.seedPrefix,
      idempotencyKey: input.idempotencyKey,
      strategy,
      privacyOwnerUserId: input.userId,
      inputHash,
      createdAt,
    };
    return await this.#client.transaction(async client => {
      await client.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [input.userId]);
      const existingRun = await this.#findByIdempotency({
        userId: input.userId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        idempotencyKey: input.idempotencyKey,
      }, client);
      if (existingRun !== null) {
        if (existingRun.request.inputHash !== inputHash) {
          throw new SimulationError(
            "idempotency_conflict",
            "A simulation request already exists for this idempotency key with different input.",
          );
        }
        return existingRun;
      }

      await client.query(
        `
WITH removable AS (
  SELECT id
  FROM simulation_runs
  WHERE user_id = $1
    AND status IN ('completed', 'failed', 'canceled')
  ORDER BY created_at ASC, id ASC
  LIMIT GREATEST(
    (SELECT COUNT(*) FROM simulation_runs WHERE user_id = $1) - $2 + 1,
    0
  )
)
DELETE FROM simulation_runs WHERE id IN (SELECT id FROM removable)
`.trim(),
        [input.userId, maximumRetainedSimulationRunsPerUser],
      );

      const result = await client.query<SimulationRunRow>(
        `
INSERT INTO simulation_runs (
  id,
  league_id,
  league_season_id,
  user_id,
  owner_id,
  team_id,
  idempotency_key,
  input_hash,
  request_json,
  status,
  created_at,
  updated_at
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'requested', $10, $10
WHERE (SELECT COUNT(*) FROM simulation_runs WHERE user_id = $4) < $11
ON CONFLICT (user_id, league_id, league_season_id, idempotency_key) DO NOTHING
RETURNING *, NULL::text AS result_id, NULL::jsonb AS summary_json, NULL::jsonb AS result_set_json, NULL::timestamptz AS result_created_at;
`.trim(),
        [
          createSimulationId(),
          input.leagueId,
          input.seasonId,
          input.userId,
          input.ownerId,
          input.teamId,
          input.idempotencyKey,
          inputHash,
          jsonbParameter(request),
          createdAt,
          maximumRetainedSimulationRunsPerUser,
        ],
      );
      const insertedRow = firstRow(result);
      if (insertedRow !== undefined) return runFromRow(insertedRow);

      throw new SimulationError(
        "simulation_capacity_reached",
        "Finish or cancel an active simulation before starting another one.",
      );
    });
  }

  async listForUser(
    userId: string,
    limit = maximumRetainedSimulationRunsPerUser,
  ): Promise<SimulationRun[]> {
    const result = await this.#client.query<SimulationRunRow>(
      `${selectSimulationWithoutResultSql}
WHERE r.user_id = $1
ORDER BY r.created_at DESC, r.id DESC
LIMIT $2`,
      [userId, boundedSimulationHistoryPageSize(limit)],
    );

    return result.rows.map(runFromRow);
  }

  async listHistoryForUserSeason(userId: string, seasonId: string, limit: number): Promise<SimulationRun[]> {
    const result = await this.#client.query<SimulationRunRow>(
      `${selectSimulationHistorySql}
WHERE r.user_id = $1 AND r.league_season_id = $2
ORDER BY r.created_at DESC, r.id DESC
LIMIT $3`,
      [userId, seasonId, boundedSimulationHistoryPageSize(limit)],
    );

    return result.rows.map(runFromRow);
  }

  async fetchForUser(runId: string, userId: string): Promise<SimulationRun | null> {
    const result = await this.#client.query<SimulationRunRow>(
      `${selectSimulationWithResultSql} WHERE r.id = $1 AND r.user_id = $2`,
      [runId, userId],
    );
    const row = firstRow(result);

    return row === undefined ? null : runFromRow(row);
  }

  async find(runId: string): Promise<SimulationRun> {
    const run = await this.#findById(runId);
    if (run === null) {
      throw new SimulationError("simulation_not_found", "Simulation run was not found.");
    }

    return run;
  }

  async markRunning(runId: string, now: Date): Promise<SimulationRun> {
    const result = await this.#client.query<SimulationRunRow>(
      `
UPDATE simulation_runs
SET status = 'running',
    started_at = $2,
    updated_at = $2
WHERE id = $1
RETURNING *, NULL::text AS result_id, NULL::jsonb AS summary_json, NULL::jsonb AS result_set_json, NULL::timestamptz AS result_created_at;
`.trim(),
      [runId, now],
    );
    const row = firstRow(result);
    if (row === undefined) {
      throw new SimulationError("simulation_not_found", "Simulation run was not found.");
    }

    return runFromRow(row);
  }

  async markFailed(runId: string): Promise<SimulationRun> {
    const existingRun = await this.find(runId);
    if (existingRun.status === "canceled") return existingRun;

    const now = new Date();
    await this.#client.query(
      "UPDATE simulation_runs SET status = 'failed', updated_at = $2 WHERE id = $1",
      [runId, now],
    );

    return await this.find(runId);
  }

  async markCanceled(runId: string): Promise<SimulationRun> {
    return await this.#client.transaction(async client => {
      const existingRun = await this.#findById(runId, client);
      if (existingRun === null) {
        throw new SimulationError("simulation_not_found", "Simulation run was not found.");
      }
      if (existingRun.status === "completed") return existingRun;

      const now = new Date();
      await client.query(
        `
UPDATE simulation_runs
SET status = 'canceled',
    completed_at = NULL,
    updated_at = $2
WHERE id = $1
`.trim(),
        [runId, now],
      );
      await client.query("DELETE FROM simulation_results WHERE simulation_run_id = $1", [runId]);

      return await this.#findRequired(runId, client);
    });
  }

  async resetForRerun(runId: string): Promise<SimulationRun> {
    return await this.#client.transaction(async client => {
      const existingRun = await this.#findById(runId, client);
      if (existingRun === null) {
        throw new SimulationError("simulation_not_found", "Simulation run was not found.");
      }
      if (existingRun.status === "running") return existingRun;

      const now = new Date();
      await client.query(
        `
UPDATE simulation_runs
SET status = 'requested',
    started_at = NULL,
    completed_at = NULL,
    updated_at = $2
WHERE id = $1
`.trim(),
        [runId, now],
      );
      await client.query("DELETE FROM simulation_results WHERE simulation_run_id = $1", [runId]);

      return await this.#findRequired(runId, client);
    });
  }

  async complete(runId: string, result: SimulationResult): Promise<SimulationRun> {
    return await this.#client.transaction(async client => {
      const existingRun = await this.#findById(runId, client);
      if (existingRun === null) {
        throw new SimulationError("simulation_not_found", "Simulation run was not found.");
      }
      if (existingRun.status === "canceled") return existingRun;

      await client.query(
        `
UPDATE simulation_runs
SET status = 'completed',
    completed_at = $2,
    updated_at = $2
WHERE id = $1
`.trim(),
        [runId, result.completedAt],
      );
      await client.query(
        `
INSERT INTO simulation_results (
  id,
  simulation_run_id,
  summary_json,
  result_set_json,
  created_at
) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
ON CONFLICT (simulation_run_id) DO UPDATE SET
  summary_json = EXCLUDED.summary_json,
  result_set_json = EXCLUDED.result_set_json
`.trim(),
        [
          createSimulationResultId(),
          runId,
          jsonbParameter(result.summary),
          jsonbParameter(result),
          result.completedAt,
        ],
      );

      return await this.#findRequired(runId, client);
    });
  }

  async #findById(
    runId: string,
    client: PostgresQueryClient = this.#client,
  ): Promise<SimulationRun | null> {
    const result = await client.query<SimulationRunRow>(
      `${selectSimulationWithResultSql} WHERE r.id = $1`,
      [runId],
    );
    const row = firstRow(result);

    return row === undefined ? null : runFromRow(row);
  }

  async #findRequired(
    runId: string,
    client: PostgresQueryClient = this.#client,
  ): Promise<SimulationRun> {
    const run = await this.#findById(runId, client);
    if (run === null) {
      throw new SimulationError("simulation_not_found", "Simulation run was not found.");
    }

    return run;
  }

  async #findByIdempotency(input: {
    userId: string;
    leagueId: string;
    seasonId: string;
    idempotencyKey: string;
  }, client: PostgresQueryClient = this.#client): Promise<SimulationRun | null> {
    const result = await client.query<SimulationRunRow>(
      `
${selectSimulationWithResultSql}
WHERE r.user_id = $1
  AND r.league_id = $2
  AND r.league_season_id = $3
  AND r.idempotency_key = $4
`.trim(),
      [input.userId, input.leagueId, input.seasonId, input.idempotencyKey],
    );
    const row = firstRow(result);

    return row === undefined ? null : runFromRow(row);
  }
}
