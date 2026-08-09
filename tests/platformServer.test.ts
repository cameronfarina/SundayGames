import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  InMemoryJobQueue,
  type CancelJobAtRunBoundaryInput,
  type CancelJobInput,
  type ClaimNextJobInput,
  type CompleteJobInput,
  type FailJobInput,
  type HeartbeatJobInput,
  type JobRecord,
  type JobRepository,
  type RerunJobInput,
  type SubmitJobInput,
  type UpdateJobProgressInput,
} from "../src/platform/jobs.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  dispatchNextPlatformJob,
  enqueueSimulationRunExecutionJob,
} from "../src/platform/platformJobOrchestrator.js";
import {
  createPlatformServer,
  startPlatformServer,
  type PlatformServer,
} from "../src/platform/platformServer.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import {
  InMemorySimulationRepository,
  type CreateSimulationRequestInput,
  type SimulationMockBatchRunner,
  type SimulationRepository,
  type SimulationResult,
  type SimulationRun,
} from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}) => ({
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

interface JsonFetchResult {
  status: number;
  contentType: string | null;
  body: unknown;
}

interface StoredSnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

interface InsertGate {
  entered: () => void;
  release: Promise<void>;
}

class FakePostgresClient implements PostgresQueryClient {
  row: StoredSnapshotRow | undefined;
  nextInsertGate: InsertGate | undefined;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE INDEX")) {
      return { rows: [] };
    }

    if (text.startsWith("SELECT revision, snapshot_json")) {
      return { rows: this.row === undefined ? [] : [this.row as TRow] };
    }

    if (text.startsWith("INSERT INTO platform_store_snapshots")) {
      if (this.nextInsertGate !== undefined) {
        const gate = this.nextInsertGate;
        this.nextInsertGate = undefined;
        gate.entered();
        await gate.release;
      }

      const [, nextRevisionValue, , snapshotJson, , expectedRevisionValue] = values;
      const nextRevision = Number(nextRevisionValue);
      const expectedRevision = Number(expectedRevisionValue);

      if (this.row === undefined) {
        if (expectedRevision !== 0) return { rows: [], rowCount: 0 };

        this.row = { revision: nextRevision, snapshot_json: snapshotJson };
        return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
      }

      if (this.row.revision !== expectedRevision) return { rows: [], rowCount: 0 };

      this.row = { revision: nextRevision, snapshot_json: snapshotJson };
      return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

class FakeTransactionalPostgresClient extends FakePostgresClient implements PostgresTransactionalQueryClient {
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

class AsyncJobRepository implements JobRepository {
  readonly inner = new InMemoryJobQueue();

  async submit(input: SubmitJobInput): Promise<JobRecord> {
    return this.inner.submit(input);
  }

  async claimNextJob(input: ClaimNextJobInput): Promise<JobRecord | null> {
    return this.inner.claimNextJob(input);
  }

  async updateProgress(input: UpdateJobProgressInput): Promise<JobRecord> {
    return this.inner.updateProgress(input);
  }

  async heartbeatJob(input: HeartbeatJobInput): Promise<JobRecord> {
    return this.inner.heartbeatJob(input);
  }

  async completeJob(input: CompleteJobInput): Promise<JobRecord> {
    return this.inner.completeJob(input);
  }

  async failJob(input: FailJobInput): Promise<JobRecord> {
    return this.inner.failJob(input);
  }

  async cancelJob(input: CancelJobInput): Promise<JobRecord> {
    return this.inner.cancelJob(input);
  }

  async cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): Promise<JobRecord> {
    return this.inner.cancelJobAtRunBoundary(input);
  }

  async rerunJob(input: RerunJobInput): Promise<JobRecord> {
    return this.inner.rerunJob(input);
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return this.inner.listForUser(userId);
  }

  async fetchForUser(jobId: string, userId: string): Promise<JobRecord | null> {
    return this.inner.fetchForUser(jobId, userId);
  }
}

class AsyncSimulationRepository implements SimulationRepository {
  readonly inner = new InMemorySimulationRepository();

  async createRequest(input: CreateSimulationRequestInput): Promise<SimulationRun> {
    return this.inner.createRequest(input);
  }

  async listForUser(userId: string): Promise<SimulationRun[]> {
    return this.inner.listForUser(userId);
  }

  async fetchForUser(runId: string, userId: string): Promise<SimulationRun | null> {
    return this.inner.fetchForUser(runId, userId);
  }

  async find(runId: string): Promise<SimulationRun> {
    return this.inner.find(runId);
  }

  async markRunning(runId: string, runAt: Date): Promise<SimulationRun> {
    return this.inner.markRunning(runId, runAt);
  }

  async markFailed(runId: string): Promise<SimulationRun> {
    return this.inner.markFailed(runId);
  }

  async markCanceled(runId: string): Promise<SimulationRun> {
    return this.inner.markCanceled(runId);
  }

  async resetForRerun(runId: string): Promise<SimulationRun> {
    return this.inner.resetForRerun(runId);
  }

  async complete(runId: string, result: SimulationResult): Promise<SimulationRun> {
    return this.inner.complete(runId, result);
  }
}

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve!: () => void;
  const promise = new Promise<void>(innerResolve => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

const listen = async (platformServer: PlatformServer): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    platformServer.server.once("error", reject);
    platformServer.server.listen(0, "127.0.0.1", resolve);
  });

  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<JsonFetchResult> => {
  const response = await fetch(`${baseUrl}${path}`, init);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.json(),
  };
};

describe("platform server composition", () => {
  let directory: string | undefined;
  const servers: PlatformServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => server.close()));
    servers.length = 0;

    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
      directory = undefined;
    }
  });

  const storePath = async (): Promise<string> => {
    directory = await mkdtemp(join(tmpdir(), "mockd-platform-server-"));

    return join(directory, "platform-store.json");
  };

  const createListeningServer = async (
    options: Partial<Parameters<typeof createPlatformServer>[0]> = {},
  ): Promise<{ platformServer: PlatformServer; baseUrl: string }> => {
    const platformServer = await createPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
      ...options,
    });
    servers.push(platformServer);

    return {
      platformServer,
      baseUrl: await listen(platformServer),
    };
  };

  it("creates accounts and logs in through the real HTTP server", async () => {
    const { baseUrl } = await createListeningServer();

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  Cam@Example.com ",
        password: "secure password",
      }),
    });

    expect(created).toMatchObject({
      status: 201,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "cam@example.com",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
    });

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login).toMatchObject({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "cam@example.com",
        },
        session: {
          id: expect.stringMatching(/^sess_/),
          accountId: expect.any(String),
          createdAt: now.toISOString(),
        },
        sessionToken: expect.any(String),
      },
    });
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
  });

  it("keeps createPlatformServer unbound and starts listening only through the start helper", async () => {
    const platformServer = await createPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(platformServer);

    expect(platformServer.server.listening).toBe(false);

    const startedServer = await startPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
      port: 0,
      host: "127.0.0.1",
    });
    servers.push(startedServer);

    expect(startedServer.server.listening).toBe(true);
    expect(startedServer.url).toBe(`http://127.0.0.1:${startedServer.port}`);

    const created = await jsonFetch(startedServer.url, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "start-helper@example.com",
        password: "secure password",
      }),
    });

    expect(created.status).toBe(201);
  });

  it("returns adapter JSON errors for malformed request bodies", async () => {
    const { baseUrl } = await createListeningServer();

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"email\":",
    });

    expect(response).toEqual({
      status: 400,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
    });
  });

  it("loads file-backed state on startup and persists successful mutations", async () => {
    const dataFilePath = await storePath();
    const { platformServer, baseUrl } = await createListeningServer({ dataFilePath });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    const saved = await readFile(dataFilePath, "utf8");
    expect(saved).toContain("cam@example.com");
    expect(JSON.parse(saved)).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [
          {
            account: {
              email: "cam@example.com",
              createdAt: now.toISOString(),
            },
          },
        ],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "cam@example.com",
      },
      sessionToken: expect.any(String),
    });
  });

  it("loads Postgres-backed state on startup and persists successful mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      initializePostgresSchema: true,
    });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(postgresClient.row).toMatchObject({
      revision: 1,
      snapshot_json: {
        schemaVersion: 1,
        auth: {
          accountCredentials: [
            {
              account: {
                email: "cam@example.com",
                createdAt: now.toISOString(),
              },
            },
          ],
        },
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "cam@example.com",
      },
      sessionToken: expect.any(String),
    });
  });

  it("recovers Postgres-backed runtime after a snapshot write conflict", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    expect(created.status).toBe(201);

    if (postgresClient.row === undefined) {
      throw new Error("Expected first account mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };

    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });

    expect(conflict).toEqual({
      status: 409,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "snapshot_write_conflict",
          message: "Stored draft data changed before this request could be saved. Reload and try again.",
        },
      },
    });
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const failedLocalLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });
    expect(failedLocalLogin).toMatchObject({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
        },
      },
    });

    const committedLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    expect(committedLogin.status).toBe(200);
  });

  it("serializes Postgres snapshot-backed HTTP mutations in process", async () => {
    const postgresClient = new FakePostgresClient();
    const firstInsertEntered = deferred();
    const releaseFirstInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: firstInsertEntered.resolve,
      release: releaseFirstInsert.promise,
    };
    const { baseUrl } = await createListeningServer({
      postgresClient,
    });

    const firstCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password",
      }),
    });

    await firstInsertEntered.promise;
    const secondCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password",
      }),
    });

    releaseFirstInsert.resolve();

    await expect(Promise.all([firstCreate, secondCreate])).resolves.toMatchObject([
      { status: 201 },
      { status: 201 },
    ]);
    expect(postgresClient.row?.revision).toBe(2);

    const firstLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password",
      }),
    });
    const secondLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password",
      }),
    });

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
  });

  it("serializes Postgres snapshot-backed worker mutations with HTTP mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "postgres-worker",
      idempotencyKey: "postgres-worker",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();
    expect(postgresClient.row?.revision).toBe(1);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "postgres-worker",
      now,
    });
    const workerInsertEntered = deferred();
    const releaseWorkerInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: workerInsertEntered.resolve,
      release: releaseWorkerInsert.promise,
    };
    const workerDispatch = dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: platformServer.jobHandlers,
    });

    await workerInsertEntered.promise;
    const accountCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });

    releaseWorkerInsert.resolve();

    await expect(workerDispatch).resolves.toBe(job);
    await expect(accountCreate).resolves.toMatchObject({ status: 201 });
    expect(job.status).toBe("completed");
    expect(postgresClient.row?.revision).toBe(3);

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });
    expect(login.status).toBe(200);
  });

  it("runs cached job handlers against the reloaded Postgres runtime", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    const cachedHandlers = platformServer.jobHandlers;
    platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "cached-handler",
      idempotencyKey: "cached-handler",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    if (postgresClient.row === undefined) {
      throw new Error("Expected setup mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };
    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });
    expect(conflict.status).toBe(409);
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "cached-handler",
      now,
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: cachedHandlers,
    })).resolves.toBe(job);
    expect(postgresClient.row?.revision).toBe(3);
    await expect(platformServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
      },
    });
  });

  it("uses an injected async job repository for HTTP enqueue and reads without snapshot persistence", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
    });
    platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "external-queue",
      idempotencyKey: "external-queue",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulation.id}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-queue-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const jobs = await jsonFetch(baseUrl, "/jobs", {
      headers: { "x-session-token": cam.sessionToken },
    });
    const enqueuedJobId = (enqueued.body as { job: { id: string } }).job.id;
    const canceled = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        now: new Date(now.getTime() + 2_000).toISOString(),
      }),
    });

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(enqueued).toMatchObject({
      status: 202,
      body: {
        job: {
          id: expect.stringMatching(/^job_/),
          userId: cam.account.id,
          leagueId: season.leagueId,
          seasonId: season.id,
          status: "queued",
        },
      },
    });
    expect(jobs).toMatchObject({
      status: 200,
      body: {
        jobs: [
          {
            id: enqueuedJobId,
            status: "queued",
          },
        ],
      },
    });
    expect(canceled).toMatchObject({
      status: 200,
      body: {
        job: {
          id: enqueuedJobId,
          status: "canceled",
        },
      },
    });
    expect(jobRepository.inner.jobs()).toHaveLength(1);
    expect(jobRepository.inner.fetchForUser(enqueuedJobId, cam.account.id)).toMatchObject({
      id: enqueuedJobId,
      status: "canceled",
    });

    const savedSnapshot = JSON.parse(await readFile(dataFilePath, "utf8")) as {
      jobs?: unknown[];
      simulationRuns?: Array<{ id?: unknown; status?: unknown }>;
    };
    expect(savedSnapshot.jobs).toEqual([]);
    expect(savedSnapshot.simulationRuns).toEqual([
      expect.objectContaining({
        id: simulation.id,
        status: "canceled",
      }),
    ]);
  });

  it("uses external job and simulation repositories for private simulation lifecycle without snapshot results", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const simulationRepository = new AsyncSimulationRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
    });
    platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    await platformServer.persist();

    const created = await jsonFetch(baseUrl, "/simulations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 6,
        seedPrefix: "external-sim",
        idempotencyKey: "external-sim",
        strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
        now: new Date(now.getTime() + 500).toISOString(),
      }),
    });
    const simulationId = (created.body as { simulation: { id: string } }).simulation.id;
    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulationId}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-sim-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const enqueuedJobId = (enqueued.body as { job: { id: string } }).job.id;
    const canceled = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        now: new Date(now.getTime() + 2_000).toISOString(),
      }),
    });
    const rerun = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/rerun`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "rerun-external-sim-job",
        now: new Date(now.getTime() + 3_000).toISOString(),
      }),
    });
    const rerunJobId = (rerun.body as { job: { id: string } }).job.id;

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(platformServer.simulationRepository).toBe(simulationRepository);
    expect(created).toMatchObject({
      status: 201,
      body: {
        simulation: {
          id: simulationId,
          status: "requested",
        },
      },
    });
    expect(canceled).toMatchObject({
      status: 200,
      body: {
        job: {
          id: enqueuedJobId,
          status: "canceled",
        },
      },
    });
    expect(await simulationRepository.fetchForUser(simulationId, cam.account.id)).toMatchObject({
      id: simulationId,
      status: "requested",
      result: undefined,
    });

    await expect(dispatchNextPlatformJob({
      repository: jobRepository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 4_000),
      handlers: platformServer.jobHandlers,
    })).resolves.toMatchObject({
      id: rerunJobId,
      status: "completed",
    });
    expect(await simulationRepository.fetchForUser(simulationId, cam.account.id)).toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);

    await expect(loadedServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulationId,
      now: new Date(now.getTime() + 5_000),
    })).resolves.toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
      },
    });

    const savedSnapshot = JSON.parse(await readFile(dataFilePath, "utf8")) as {
      jobs?: unknown[];
      simulationRuns?: unknown[];
    };
    expect(savedSnapshot.jobs).toEqual([]);
    expect(savedSnapshot.simulationRuns).toEqual([]);
  });

  it("creates a Postgres job queue when a transactional job client is configured", async () => {
    const postgresJobClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresJobClient });

    expect(platformServer.postgresJobQueue).toBeDefined();
    expect(platformServer.jobRepository).toBe(platformServer.postgresJobQueue);
  });

  it("creates a Postgres simulation repository when a transactional simulation client is configured", async () => {
    const postgresSimulationClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresSimulationClient });

    expect(platformServer.postgresSimulationRepository).toBeDefined();
    expect(platformServer.simulationRepository).toBe(platformServer.postgresSimulationRepository);
  });

  it("rejects ambiguous file and Postgres persistence configuration", async () => {
    await expect(createPlatformServer({
      dataFilePath: "/tmp/mockd-platform.json",
      postgresClient: new FakePostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either dataFilePath or postgresClient, not both.");

    await expect(createPlatformServer({
      jobRepository: new AsyncJobRepository(),
      postgresJobClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either jobRepository or postgresJobClient, not both.");

    await expect(createPlatformServer({
      simulationRepository: new AsyncSimulationRepository(),
      postgresSimulationClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either simulationRepository or postgresSimulationClient, not both.");
  });

  it("persists worker-completed private simulations in the file-backed store", async () => {
    const dataFilePath = await storePath();
    const { platformServer } = await createListeningServer({ dataFilePath });
    platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "server-worker",
      idempotencyKey: "server-worker",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "server-worker",
      now,
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: platformServer.jobHandlers,
    })).resolves.toBe(job);
    expect(job.status).toBe("completed");

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);

    await expect(loadedServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      },
    });
  });
});
