import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { AccountRecord } from "../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
} from "../src/platform/platformHttp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const expectBodyRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected response body record.");

  return value;
};

const expectString = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string response field.");

  return value;
};

const expectAccount = (value: unknown): AccountRecord => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date)
  ) {
    throw new Error("Expected account response field.");
  }

  return {
    id: value.id,
    email: value.email,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const createLoggedInAccount = async (
  handle: PlatformHttpHandler,
  email: string,
): Promise<{ account: AccountRecord; sessionToken: string }> => {
  await handle({
    method: "POST",
    path: "/accounts",
    body: {
      email,
      password: "secure password",
      now,
    },
  });

  const login = await handle({
    method: "POST",
    path: "/sessions",
    body: {
      email,
      password: "secure password",
      now,
    },
  });
  const loginBody = expectBodyRecord(login.body);

  return {
    account: expectAccount(loginBody.account),
    sessionToken: expectString(loginBody.sessionToken),
  };
};

describe("platform HTTP contract", () => {
  it("creates accounts, logs in, and returns stable auth error responses", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const created = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "  Cam@Example.com ",
        password: "secure password",
        now,
      },
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "cam@example.com",
      },
    });

    const duplicate = await handle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "cam@example.com",
        password: "different password",
        now,
      },
    });

    expect(duplicate).toEqual({
      status: 409,
      body: {
        error: {
          code: "duplicate_email",
          message: "An account with this email already exists.",
        },
      },
    });

    const rejectedLogin = await handle({
      method: "POST",
      path: "/sessions",
      body: {
        email: "cam@example.com",
        password: "wrong password",
        now,
      },
    });

    expect(rejectedLogin).toEqual({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
          message: "Email or password is incorrect.",
        },
      },
    });

    const login = await handle({
      method: "POST",
      path: "/sessions",
      body: {
        email: "cam@example.com",
        password: "secure password",
        now,
      },
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        id: expect.stringMatching(/^acct_/),
        email: "cam@example.com",
      },
      session: {
        id: expect.stringMatching(/^sess_/),
        accountId: expect.any(String),
      },
      sessionToken: expect.any(String),
    });
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
    expect(JSON.stringify(login.body)).not.toContain("scrypt");
  });

  it("does not authenticate protected routes with session tokens in query strings or bodies", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");

    const queryTokenResponse = await handle({
      method: "GET",
      path: `/seasons/missing-season?sessionToken=${encodeURIComponent(cam.sessionToken)}`,
    });
    const bodyTokenResponse = await handle({
      method: "GET",
      path: "/seasons/missing-season",
      body: {
        sessionToken: cam.sessionToken,
      },
    });

    expect(queryTokenResponse).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });
    expect(bodyTokenResponse).toEqual(queryTokenResponse);
  });

  it("returns user-facing live sale validation errors through the HTTP boundary", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
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
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        roomId: "room_wr_limit",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
        ],
        now,
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/start",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room-wr-limit",
        now: new Date(now.getTime() + 1_000),
      },
    });

    const overLimitSale = await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "sale:legette:2",
        sale: "cam legette 2",
        now: new Date(now.getTime() + 2_000),
      },
    });

    expect(overLimitSale).toEqual({
      status: 409,
      body: {
        error: {
          code: "position_limit",
          message: "Cam cannot buy Xavier Legette: roster limit is 6 WRs.",
        },
      },
    });
  });

  it("routes season, simulation, mock session, live room, and export calls through PlatformApp", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const cam = await createLoggedInAccount(handle, "cam@example.com");
    const seth = await createLoggedInAccount(handle, "seth@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registered = await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: cam.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
          {
            userId: seth.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: sethTeam.ownerId,
            teamId: sethTeam.id,
          },
        ],
        now: now.toISOString(),
      },
    });

    expect(registered.status).toBe(200);
    expect(registered.body).toMatchObject({ season });

    const fetchedSeason = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      headers: {
        "x-session-token": seth.sessionToken,
      },
    });

    expect(fetchedSeason.status).toBe(200);
    expect(fetchedSeason.body).toMatchObject({ season });

    const mismatchedSeason = await handle({
      method: "PUT",
      path: "/seasons/another-season",
      sessionToken: cam.sessionToken,
      body: {
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
      },
    });

    expect(mismatchedSeason).toEqual({
      status: 400,
      body: {
        error: {
          code: "season_id_mismatch",
          message: "Season body must match the route season id.",
        },
      },
    });

    const importPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2026,player-puka",
        now,
      },
    });
    const previewBody = expectBodyRecord(importPreview.body);
    const previewBatch = expectBodyRecord(previewBody.batch);
    const previewBatchId = expectString(previewBatch.id);

    expect(importPreview.status).toBe(200);
    expect(importPreview.body).toMatchObject({
      source: {
        fileHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        sourceRowCount: 2,
      },
      batch: expect.objectContaining({ status: "previewed" }),
    });

    const committedImport = await handle({
      method: "POST",
      path: `/historical-imports/${previewBatchId}/commit`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 250).toISOString(),
      },
    });

    expect(committedImport.body).toMatchObject({
      committedRecords: [expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 })],
    });

    const secondImportPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: cam.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year,player id\nCam,Jahmyr Gibbs,RB,72,2026,player-gibbs",
        now: new Date(now.getTime() + 300).toISOString(),
      },
    });
    const secondPreviewBody = expectBodyRecord(secondImportPreview.body);
    const secondPreviewBatch = expectBodyRecord(secondPreviewBody.batch);
    const secondPreviewBatchId = expectString(secondPreviewBatch.id);
    const conflictingImportCommit = await handle({
      method: "POST",
      path: `/historical-imports/${secondPreviewBatchId}/commit`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 350).toISOString(),
      },
    });

    expect(conflictingImportCommit).toEqual({
      status: 409,
      body: {
        error: {
          code: "season_import_conflict",
          message: "Historical import batch already exists for this league season. Request replacement to supersede it.",
        },
      },
    });

    const pricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: cam.sessionToken,
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
        now: new Date(now.getTime() + 500).toISOString(),
      },
    });
    const pricingBody = expectBodyRecord(pricingRebuild.body);
    const modelRunId = expectString(pricingBody.modelRunId);

    expect(pricingRebuild.status).toBe(201);
    expect(pricingRebuild.body).toMatchObject({
      snapshots: [
        expect.objectContaining({
          scenarioId: "balanced",
          rows: [expect.objectContaining({ playerName: "Puka Nacua", marketPrice: 60 })],
        }),
      ],
    });

    const conflictingPricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: cam.sessionToken,
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
        now: new Date(now.getTime() + 550).toISOString(),
      },
    });

    expect(conflictingPricingRebuild).toEqual({
      status: 409,
      body: {
        error: {
          code: "pricing_snapshot_conflict",
          message: `Cannot overwrite pricing snapshot for modelRunId ${modelRunId} and scenarioId balanced with a different payload.`,
        },
      },
    });

    const listedPricing = await handle({
      method: "GET",
      path: `/seasons/${season.id}/pricing-snapshots?scenarioId=balanced`,
      sessionToken: seth.sessionToken,
    });
    const fetchedPricing = await handle({
      method: "GET",
      path: `/pricing-snapshots/${encodeURIComponent(modelRunId)}?scenarioId=balanced`,
      sessionToken: seth.sessionToken,
    });

    expect(listedPricing.body).toMatchObject({
      pricingSnapshots: [expect.objectContaining({ modelRunId })],
    });
    expect(fetchedPricing.body).toMatchObject({
      pricingSnapshot: expect.objectContaining({ modelRunId, scenarioId: "balanced" }),
    });

    const createdSimulation = await handle({
      method: "POST",
      path: "/simulations",
      sessionToken: cam.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 25,
        seedPrefix: "cam-puka-plan",
        idempotencyKey: "cam-puka-plan",
        strategy: {
          hardLocks: [
            { playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" },
          ],
        },
        now,
      },
    });
    const simulation = expectBodyRecord(createdSimulation.body).simulation;
    if (!isRecord(simulation)) throw new Error("Expected simulation response.");
    const simulationId = expectString(simulation.id);

    expect(createdSimulation.status).toBe(201);

    const enqueuedSimulationJob = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/jobs`,
      sessionToken: cam.sessionToken,
      body: {
        idempotencyKey: "job:cam-puka-plan",
        now: new Date(now.getTime() + 750).toISOString(),
      },
    });

    expect(enqueuedSimulationJob.status).toBe(202);
    expect(enqueuedSimulationJob.body).toMatchObject({
      job: expect.objectContaining({
        kind: "simulation",
        status: "queued",
      }),
    });

    const listedJobs = await handle({
      method: "GET",
      path: "/jobs",
      sessionToken: cam.sessionToken,
    });

    expect(listedJobs.body).toMatchObject({
      jobs: [expect.objectContaining({ kind: "simulation" })],
    });
    const enqueuedJob = expectBodyRecord(enqueuedSimulationJob.body).job;
    if (!isRecord(enqueuedJob)) throw new Error("Expected job response.");
    const enqueuedJobId = expectString(enqueuedJob.id);

    const canceledJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/cancel`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 900).toISOString(),
      },
    });

    expect(canceledJob).toMatchObject({
      status: 200,
      body: {
        job: expect.objectContaining({
          id: enqueuedJobId,
          status: "canceled",
        }),
      },
    });
    const fetchedCanceledSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: cam.sessionToken,
    });

    expect(fetchedCanceledSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "canceled",
        result: undefined,
      }),
    });

    const rerunJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/rerun`,
      sessionToken: cam.sessionToken,
      body: {
        idempotencyKey: "rerun-cam-puka-plan",
        now: new Date(now.getTime() + 950).toISOString(),
      },
    });
    const rerunJobBody = expectBodyRecord(rerunJob.body);
    const rerunJobRecord = expectBodyRecord(rerunJobBody.job);
    const rerunJobId = expectString(rerunJobRecord.id);

    expect(rerunJob).toMatchObject({
      status: 202,
      body: {
        job: expect.objectContaining({
          id: rerunJobId,
          status: "queued",
          idempotencyKey: `rerun:${enqueuedJobId}:rerun-cam-puka-plan`,
        }),
      },
    });
    expect(rerunJobId).not.toBe(enqueuedJobId);

    const listedSimulations = await handle({
      method: "GET",
      path: "/simulations",
      sessionToken: cam.sessionToken,
    });

    expect(listedSimulations.body).toMatchObject({
      simulations: [
        expect.objectContaining({ id: simulationId, status: "requested" }),
      ],
    });

    const fetchedSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: cam.sessionToken,
    });

    expect(fetchedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({ id: simulationId, status: "requested" }),
    });

    const executedSimulation = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/execute`,
      sessionToken: cam.sessionToken,
      body: {
        now: new Date(now.getTime() + 1_000).toISOString(),
      },
    });

    expect(executedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "completed",
        result: expect.objectContaining({ runCount: 25 }),
      }),
    });

    const createdMockSession = await handle({
      method: "POST",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
        now,
      },
    });
    const mockSession = expectBodyRecord(createdMockSession.body).mockSession;
    if (!isRecord(mockSession)) throw new Error("Expected mock session response.");
    const mockSessionId = expectString(mockSession.id);

    expect(createdMockSession.status).toBe(201);

    const listedMockSessions = await handle({
      method: "GET",
      path: "/mock-sessions",
      sessionToken: cam.sessionToken,
      query: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
      },
    });

    expect(listedMockSessions.body).toMatchObject({
      mockSessions: [expect.objectContaining({ id: mockSessionId })],
    });

    const appendedMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/commands`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_puka",
        command: "draft puka for 62",
        idempotencyKey: "mock:puka:62",
        now: new Date(now.getTime() + 2_000).toISOString(),
      },
    });

    expect(appendedMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        commandLog: [expect.objectContaining({ id: "cmd_puka" })],
      }),
    });

    const resetMockSession = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        now: new Date(now.getTime() + 3_000),
      },
    });

    expect(resetMockSession.body).toMatchObject({
      mockSession: expect.objectContaining({
        id: mockSessionId,
        revision: 2,
        commandLog: [],
      }),
    });

    const staleMockReset = await handle({
      method: "POST",
      path: `/mock-sessions/${mockSessionId}/reset`,
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
      },
    });

    expect(staleMockReset).toEqual({
      status: 409,
      body: {
        error: {
          code: "stale_revision",
          message: "Mock draft session changed since this action was prepared. Refresh and try again.",
        },
      },
    });

    const createdRoom = await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: cam.sessionToken,
      body: {
        seasonId: season.id,
        roomId: "room_214674_2026",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
        ],
        now,
      },
    });

    expect(createdRoom.status).toBe(201);
    expect(createdRoom.body).toMatchObject({
      room: expect.objectContaining({
        roomId: "room_214674_2026",
        status: "setup",
      }),
    });

    const fetchedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026",
      sessionToken: seth.sessionToken,
    });

    expect(fetchedRoom.body).toMatchObject({
      room: expect.objectContaining({ roomId: "room_214674_2026" }),
    });

    const startedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/start",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room",
        now: new Date(now.getTime() + 4_000),
      },
    });

    expect(startedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "live", revision: 2 }),
    });

    const soldRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "sale:puka:62",
        sale: "cam puka 62",
        now: new Date(now.getTime() + 5_000),
      },
    });

    expect(soldRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 3,
        projection: expect.objectContaining({
          sales: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
        }),
      }),
    });

    const undoneRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/undo",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "undo:puka:62",
        now: new Date(now.getTime() + 6_000),
      },
    });

    expect(undoneRoom.body).toMatchObject({
      room: expect.objectContaining({
        revision: 4,
        projection: expect.objectContaining({ sales: [] }),
      }),
    });

    await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/sales",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 4,
        idempotencyKey: "sale:puka:62:after-undo",
        sale: "cam puka 62",
        now: new Date(now.getTime() + 7_000),
      },
    });

    const endedRoom = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/end",
      sessionToken: cam.sessionToken,
      body: {
        expectedRevision: 5,
        idempotencyKey: "end-room",
        now: new Date(now.getTime() + 8_000),
      },
    });

    expect(endedRoom.body).toMatchObject({
      room: expect.objectContaining({ status: "ended", revision: 6 }),
    });

    const exportedRoom = await handle({
      method: "GET",
      path: "/live-rooms/room_214674_2026/export?exportedAt=2026-08-09T12%3A00%3A09.000Z",
      sessionToken: seth.sessionToken,
    });

    expect(exportedRoom.body).toMatchObject({
      draftExport: expect.objectContaining({
        sheetName: "Draft Results",
        csv: expect.stringContaining("Puka Nacua,62"),
      }),
    });

    const exportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: seth.sessionToken,
      body: {
        exportedAt: "2026-08-09T12:00:10.000Z",
      },
    });
    const retriedExportArtifact = await handle({
      method: "POST",
      path: "/live-rooms/room_214674_2026/export-artifacts",
      sessionToken: seth.sessionToken,
    });

    expect(exportArtifact.status).toBe(201);
    expect(exportArtifact.body).toMatchObject({
      artifact: expect.objectContaining({
        roomId: "room_214674_2026",
        format: "csv",
        sourceRevision: 6,
      }),
      content: expect.stringContaining("Puka Nacua,62"),
    });
    expect(retriedExportArtifact).toEqual(exportArtifact);
  });

  it("maps known domain errors and unexpected failures without leaking stack traces", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const unauthenticated = await handle({
      method: "GET",
      path: "/seasons/missing-season",
    });

    expect(JSON.stringify(unauthenticated.body)).not.toContain("stack");
    expect(unauthenticated).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });

    const unknownFailureApp: Pick<PlatformApp, "createAccount"> = {
      createAccount: () => {
        throw new Error("database stack trace with secrets");
      },
    };
    const failingHandle = createPlatformHttpHandler({
      ...app,
      createAccount: unknownFailureApp.createAccount,
    });

    const failure = await failingHandle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "fail@example.com",
        password: "secure password",
      },
    });

    expect(JSON.stringify(failure.body)).not.toContain("database stack trace with secrets");
    expect(JSON.stringify(failure.body)).not.toContain("stack");
    expect(failure).toEqual({
      status: 500,
      body: {
        error: {
          code: "internal_error",
          message: "Something went wrong.",
        },
      },
    });
  });
});
