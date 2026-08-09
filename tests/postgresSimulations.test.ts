import { describe, expect, it } from "vitest";
import type { ForcedAuctionSale, MockBatch } from "../src/modeling/mockBatch.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type {
  PostgresTransactionalQueryClient,
} from "../src/platform/postgresJobQueue.js";
import { PostgresSimulationRepository } from "../src/platform/postgresSimulations.js";
import {
  SimulationError,
  executeSimulationRun,
  type SimulationRunStatus,
} from "../src/platform/simulations.js";

const now = new Date("2026-08-09T16:00:00.000Z");

const baseRequestInput = {
  userId: "user_cam",
  leagueId: "league_214674",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix: "cam-balanced-rb3",
  idempotencyKey: "balanced-rb3",
  strategy: {
    hardLocks: [
      {
        playerName: "Jadarian Price",
        price: 13,
        priceMode: "exact",
        auctionOwner: "Cam",
      },
    ],
    softTargets: [
      {
        label: "good-not-elite-rb2",
        candidatePool: ["Breece Hall", "Kenneth Walker III", "Chase Brown"],
        maxBid: 35,
      },
    ],
  },
} as const;

interface StoredSimulationRunRow {
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
  status: SimulationRunStatus;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface StoredSimulationResultRow {
  id: string;
  simulation_run_id: string;
  summary_json: unknown;
  result_set_json: unknown;
  created_at: Date;
}

type JoinedSimulationRow = StoredSimulationRunRow & {
  result_id: string | null;
  summary_json: unknown;
  result_set_json: unknown;
  result_created_at: Date | null;
};

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneDate = (value: Date | null): Date | null =>
  value === null ? null : new Date(value.getTime());

const jsonbParameterValue = (value: unknown): unknown =>
  typeof value === "string" ? JSON.parse(value) : cloneJson(value);

const cloneRunRow = (row: StoredSimulationRunRow): StoredSimulationRunRow => ({
  ...row,
  request_json: cloneJson(row.request_json),
  started_at: cloneDate(row.started_at),
  completed_at: cloneDate(row.completed_at),
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

const cloneResultRow = (row: StoredSimulationResultRow): StoredSimulationResultRow => ({
  ...row,
  summary_json: cloneJson(row.summary_json),
  result_set_json: cloneJson(row.result_set_json),
  created_at: new Date(row.created_at.getTime()),
});

const fakeBatch = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}: {
  runsPerScenario: number;
  seedPrefix: string;
  forcedSales: readonly ForcedAuctionSale[];
}): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

class FakePostgresSimulationClient implements PostgresTransactionalQueryClient {
  readonly queries: { text: string; values: readonly unknown[]; inTransaction: boolean }[] = [];
  readonly runs = new Map<string, StoredSimulationRunRow>();
  readonly results = new Map<string, StoredSimulationResultRow>();
  transactionCount = 0;
  commitCount = 0;
  rollbackCount = 0;
  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const previousTransactionState = this.#inTransaction;
    this.#inTransaction = true;

    try {
      const result = await operation(this);
      this.commitCount += 1;
      return result;
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    } finally {
      this.#inTransaction = previousTransactionState;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values, inTransaction: this.#inTransaction });
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("INSERT INTO simulation_runs")) {
      const row = this.#rowFromInsert(values);
      const existing = this.#findByIdempotency(
        row.user_id,
        row.league_id,
        row.league_season_id,
        row.idempotency_key,
      );

      if (existing !== undefined) return { rows: [], rowCount: 0 };

      this.runs.set(row.id, row);
      return { rows: [this.#joinedRow(row) as TRow], rowCount: 1 };
    }

    if (
      normalizedSql.includes("FROM simulation_runs r LEFT JOIN simulation_results sr") &&
      normalizedSql.includes("WHERE r.user_id = $1 AND r.league_id = $2")
    ) {
      const [userId, leagueId, seasonId, idempotencyKey] = values as readonly [string, string, string, string];
      const row = this.#findByIdempotency(userId, leagueId, seasonId, idempotencyKey);

      return { rows: row === undefined ? [] : [this.#joinedRow(row) as TRow] };
    }

    if (
      normalizedSql.includes("FROM simulation_runs r LEFT JOIN simulation_results sr") &&
      normalizedSql.includes("WHERE r.id = $1 AND r.user_id = $2")
    ) {
      const [runId, userId] = values as readonly [string, string];
      const row = this.runs.get(runId);

      return { rows: row === undefined || row.user_id !== userId ? [] : [this.#joinedRow(row) as TRow] };
    }

    if (
      normalizedSql.includes("FROM simulation_runs r LEFT JOIN simulation_results sr") &&
      normalizedSql.includes("WHERE r.id = $1")
    ) {
      const [runId] = values as readonly [string];
      const row = this.runs.get(runId);

      return { rows: row === undefined ? [] : [this.#joinedRow(row) as TRow] };
    }

    if (
      normalizedSql.includes("FROM simulation_runs r LEFT JOIN simulation_results sr") &&
      normalizedSql.includes("WHERE r.user_id = $1 ORDER BY")
    ) {
      const [userId] = values as readonly [string];
      const rows = [...this.runs.values()]
        .filter(row => row.user_id === userId)
        .sort((left, right) => {
          const createdAtOrder = left.created_at.getTime() - right.created_at.getTime();

          return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
        })
        .map(row => this.#joinedRow(row) as TRow);

      return { rows };
    }

    if (normalizedSql.startsWith("UPDATE simulation_runs SET status = 'running'")) {
      const [runId, nowValue] = values as readonly [string, Date];
      const row = this.#requireRow(runId);

      row.status = "running";
      row.started_at = nowValue;
      row.updated_at = nowValue;

      return { rows: [this.#joinedRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE simulation_runs SET status = 'failed'")) {
      const [runId, nowValue] = values as readonly [string, Date];
      const row = this.#requireRow(runId);

      row.status = "failed";
      row.updated_at = nowValue;

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE simulation_runs SET status = 'canceled'")) {
      const [runId, nowValue] = values as readonly [string, Date];
      const row = this.#requireRow(runId);

      row.status = "canceled";
      row.completed_at = null;
      row.updated_at = nowValue;

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE simulation_runs SET status = 'requested'")) {
      const [runId, nowValue] = values as readonly [string, Date];
      const row = this.#requireRow(runId);

      row.status = "requested";
      row.started_at = null;
      row.completed_at = null;
      row.updated_at = nowValue;

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE simulation_runs SET status = 'completed'")) {
      const [runId, completedAt] = values as readonly [string, Date];
      const row = this.#requireRow(runId);

      row.status = "completed";
      row.completed_at = completedAt;
      row.updated_at = completedAt;

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("DELETE FROM simulation_results")) {
      const [runId] = values as readonly [string];

      this.results.delete(runId);
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO simulation_results")) {
      const [id, runId, summaryJson, resultSetJson, createdAt] = values as readonly [
        string,
        string,
        unknown,
        unknown,
        Date,
      ];
      const row: StoredSimulationResultRow = {
        id,
        simulation_run_id: runId,
        summary_json: jsonbParameterValue(summaryJson),
        result_set_json: jsonbParameterValue(resultSetJson),
        created_at: createdAt,
      };

      this.results.set(runId, row);
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  #rowFromInsert(values: readonly unknown[]): StoredSimulationRunRow {
    const [
      id,
      leagueId,
      seasonId,
      userId,
      ownerId,
      teamId,
      idempotencyKey,
      inputHash,
      requestJson,
      createdAt,
    ] = values as readonly [string, string, string, string, string, string, string, string, unknown, Date];

    return {
      id,
      league_id: leagueId,
      league_season_id: seasonId,
      user_id: userId,
      job_id: null,
      model_run_id: null,
      pricing_snapshot_id: null,
      strategy_plan_version_id: null,
      owner_id: ownerId,
      team_id: teamId,
      idempotency_key: idempotencyKey,
      input_hash: inputHash,
      request_json: jsonbParameterValue(requestJson),
      status: "requested",
      started_at: null,
      completed_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  }

  #joinedRow(row: StoredSimulationRunRow): JoinedSimulationRow {
    const result = this.results.get(row.id);

    return {
      ...cloneRunRow(row),
      result_id: result?.id ?? null,
      summary_json: result === undefined ? null : cloneResultRow(result).summary_json,
      result_set_json: result === undefined ? null : cloneResultRow(result).result_set_json,
      result_created_at: result === undefined ? null : new Date(result.created_at.getTime()),
    };
  }

  #findByIdempotency(
    userId: string,
    leagueId: string,
    seasonId: string,
    idempotencyKey: string,
  ): StoredSimulationRunRow | undefined {
    return [...this.runs.values()].find(row =>
      row.user_id === userId &&
      row.league_id === leagueId &&
      row.league_season_id === seasonId &&
      row.idempotency_key === idempotencyKey
    );
  }

  #requireRow(runId: string): StoredSimulationRunRow {
    const row = this.runs.get(runId);
    if (row === undefined) throw new Error(`Missing simulation run ${runId}.`);

    return row;
  }
}

describe("Postgres simulation repository", () => {
  it("creates simulation requests idempotently for the same user league season and key", async () => {
    const client = new FakePostgresSimulationClient();
    const repository = new PostgresSimulationRepository(client);

    const firstRun = await repository.createRequest({ ...baseRequestInput, createdAt: now });
    const secondRun = await repository.createRequest({
      ...baseRequestInput,
      createdAt: new Date(now.getTime() + 1_000),
    });

    expect(secondRun).toEqual(firstRun);
    expect(firstRun).toMatchObject({
      id: expect.stringMatching(/^sim_/),
      request: {
        userId: "user_cam",
        leagueId: "league_214674",
        seasonId: "season_2026",
        ownerId: "owner_cam",
        teamId: "team_cam",
        count: 25,
        seedPrefix: "cam-balanced-rb3",
        idempotencyKey: "balanced-rb3",
        createdAt: now,
        privacyOwnerUserId: "user_cam",
      },
      status: "requested",
      createdAt: now,
      result: undefined,
    });
    expect(await repository.listForUser("user_cam")).toEqual([firstRun]);
  });

  it("rejects an idempotency key reused with different simulation input", async () => {
    const client = new FakePostgresSimulationClient();
    const repository = new PostgresSimulationRepository(client);

    await repository.createRequest({ ...baseRequestInput, createdAt: now });

    await expect(repository.createRequest({
      ...baseRequestInput,
      count: 50,
      createdAt: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new SimulationError(
      "idempotency_conflict",
      "A simulation request already exists for this idempotency key with different input.",
    ));
  });

  it("executes private simulations and persists result rows", async () => {
    const client = new FakePostgresSimulationClient();
    const repository = new PostgresSimulationRepository(client);
    const run = await repository.createRequest({
      ...baseRequestInput,
      strategy: {
        hardLocks: [
          {
            playerName: "Jadarian Price",
            price: 13,
            priceMode: "exact",
            auctionOwner: "Cam",
          },
          {
            playerName: "Kenneth Walker III",
            price: 30,
            priceMode: "ceiling",
            auctionOwner: "Cam",
          },
        ],
        softTargets: baseRequestInput.strategy.softTargets,
      },
      createdAt: now,
    });
    const runnerCalls: unknown[] = [];

    const completedRun = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCalls.push(options);
        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 5_000),
    });

    expect(runnerCalls).toEqual([
      expect.objectContaining({
        runsPerScenario: 25,
        seedPrefix: "cam-balanced-rb3",
        forcedSales: [
          { owner: "Cam", player: "Jadarian Price", price: 13 },
          { owner: "Cam", player: "Kenneth Walker III", price: 30 },
        ],
      }),
    ]);
    expect(completedRun.status).toBe("completed");
    expect(completedRun.result).toMatchObject({
      runId: run.id,
      requestId: run.request.id,
      runCount: 25,
      seedPrefix: "cam-balanced-rb3",
      hardLockCount: 2,
      softTargetCount: 1,
      summary: {
        runCount: 25,
      },
    });
    expect(client.results.get(run.id)?.result_set_json).toMatchObject({
      runId: run.id,
      requestId: run.request.id,
      summary: {
        runCount: 25,
      },
    });
    expect(await repository.fetchForUser(run.id, "user_other")).toBeNull();
    expect((await repository.fetchForUser(run.id, "user_cam"))?.result).toEqual(completedRun.result);
  });

  it("marks runner failures and returns completed runs idempotently", async () => {
    const client = new FakePostgresSimulationClient();
    const repository = new PostgresSimulationRepository(client);
    const run = await repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "failure-then-idempotent-completion",
      createdAt: now,
    });

    await expect(executeSimulationRun({
      repository,
      runId: run.id,
      runner: () => {
        throw new Error("runner unavailable");
      },
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow("runner unavailable");
    expect((await repository.find(run.id)).status).toBe("failed");

    let runnerCallCount = 0;
    const completed = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCallCount += 1;

        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 2_000),
    });
    const completedAgain = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCallCount += 1;

        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 3_000),
    });

    expect(completedAgain).toEqual(completed);
    expect(runnerCallCount).toBe(1);
    expect((await repository.find(run.id)).status).toBe("completed");
  });

  it("keeps canceled and reset simulation runs from carrying stale results", async () => {
    const client = new FakePostgresSimulationClient();
    const repository = new PostgresSimulationRepository(client);
    const run = await repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "cancel-before-runner-completes",
      createdAt: now,
    });

    await repository.markRunning(run.id, new Date(now.getTime() + 1_000));
    await repository.complete(run.id, {
      runId: run.id,
      requestId: run.request.id,
      completedAt: new Date(now.getTime() + 2_000),
      runCount: 25,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: run.request.strategy.hardLocks.length,
      softTargetCount: run.request.strategy.softTargets.length,
      forcedSales: [],
      summary: fakeBatch({
        runsPerScenario: 25,
        seedPrefix: run.request.seedPrefix,
        forcedSales: [],
      }).summary,
    });
    expect(client.results.has(run.id)).toBe(true);

    const resetRun = await repository.resetForRerun(run.id);
    expect(resetRun).toMatchObject({
      status: "requested",
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
    });
    expect(client.results.has(run.id)).toBe(false);

    const canceledRun = await repository.markCanceled(run.id);
    const staleCompletion = await repository.complete(run.id, {
      runId: run.id,
      requestId: run.request.id,
      completedAt: new Date(now.getTime() + 3_000),
      runCount: 25,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: run.request.strategy.hardLocks.length,
      softTargetCount: run.request.strategy.softTargets.length,
      forcedSales: [],
      summary: fakeBatch({
        runsPerScenario: 25,
        seedPrefix: run.request.seedPrefix,
        forcedSales: [],
      }).summary,
    });

    expect(canceledRun.status).toBe("canceled");
    expect(staleCompletion.status).toBe("canceled");
    expect(staleCompletion.result).toBeUndefined();
    expect(client.results.has(run.id)).toBe(false);
  });
});
