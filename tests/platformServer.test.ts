import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { InMemoryJobQueue } from "../src/platform/jobs.js";
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
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

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
    const simulation = platformServer.app.createSimulationRun({
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

    expect(loadedServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      },
    });
  });
});
