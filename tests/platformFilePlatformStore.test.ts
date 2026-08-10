import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import { FilePlatformStore } from "../src/platform/filePlatformStore.js";
import { createPlatformApp } from "../src/platform/platformApp.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const baselinePrices = [
  { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
] as const satisfies readonly PricingSourcePrice[];

const mockRunner: SimulationMockBatchRunner = () => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario: 1,
    seedPrefix: "unused",
    forcedSales: [],
  },
  runs: [],
  summary: {
    runCount: 1,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value as Record<string, unknown>;
};

describe("file-backed platform store", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
      directory = undefined;
    }
  });

  const storePath = async (): Promise<string> => {
    directory = await mkdtemp(join(tmpdir(), "mockd-platform-store-"));

    return join(directory, "platform-store.json");
  };

  it("loads an empty file as an empty store", async () => {
    const path = await storePath();
    await writeFile(path, "", "utf8");

    const loadedFileStore = await FilePlatformStore.load(path);

    expect(loadedFileStore.store.snapshot()).toMatchObject({
      leagueSeasons: [],
      liveDraftRooms: [],
      exportArtifacts: [],
    });
  });

  it("roundtrips a registered league season and active auth session", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await app.registerLeagueSeason({
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
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loadedFileStore.store, simulationRunner: mockRunner });
    const loadedSnapshot = loadedFileStore.store.snapshot();

    expect(await loadedApp.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season.id, now })).toEqual(season);
    expect(loadedSnapshot.auth.accountCredentials[0]?.account.createdAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.accountCredentials[0]?.account.updatedAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.sessions[0]?.createdAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.sessions[0]?.expiresAt).toBeInstanceOf(Date);
  });

  it("roundtrips a live room sale with revived room and event dates", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_214674_2026",
      viewerPasswordHashRef: "viewer-password-hash",
      startsAt: new Date(now.getTime() + 60_000),
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start:room_214674_2026",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loadedFileStore.store, simulationRunner: mockRunner });
    const loadedRoom = await loadedApp.getLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      now,
    });

    expect(loadedRoom.projection.sales).toEqual(sold.projection.sales);
    expect(loadedRoom.createdAt).toBeInstanceOf(Date);
    expect(loadedRoom.startsAt).toBeInstanceOf(Date);
    expect(loadedRoom.updatedAt).toBeInstanceOf(Date);
    expect(loadedRoom.projection.updatedAt).toBeInstanceOf(Date);
    expect(loadedRoom.events.map(event => event.occurredAt)).toEqual([
      now,
      new Date(now.getTime() + 1_000),
      new Date(now.getTime() + 2_000),
    ]);
  });

  it("saves auth token hashes without raw session tokens", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    await fileStore.save();
    const saved = await readFile(path, "utf8");
    const savedJson: unknown = JSON.parse(saved);
    const savedRoot = asRecord(savedJson, "saved store");
    const auth = asRecord(savedRoot.auth, "auth");
    if (!Array.isArray(auth.sessions)) throw new Error("Expected auth.sessions to be an array.");
    const firstSession = asRecord(auth.sessions[0], "first session");

    expect(firstSession.tokenHash).toBe(cam.session.tokenHash);
    expect(saved).not.toContain(cam.sessionToken);
    expect(saved).not.toContain("sessionToken");
    expect(saved).not.toContain("cam password");
  });

  it("roundtrips private simulation and mock draft session state", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await app.registerLeagueSeason({
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
    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 4,
      seedPrefix: "file-store-sim",
      idempotencyKey: "file-store-sim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    const completedSimulation = await app.executeSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 1_000),
    });
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 4, label: "File store mock" },
      now,
    });
    const updatedMockSession = await app.appendMockDraftCommand({
      actorSessionToken: cam.sessionToken,
      sessionId: mockSession.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      command: "draft puka for 62",
      idempotencyKey: "mock:puka:62",
      now: new Date(now.getTime() + 2_000),
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loadedFileStore.store, simulationRunner: mockRunner });

    await expect(loadedApp.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now,
    })).resolves.toEqual(completedSimulation);
    expect(await loadedApp.listMockDraftSessions({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      now,
    })).toEqual([updatedMockSession]);
  });

  it("roundtrips historical imports, pricing snapshots, jobs, and export artifacts", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await app.registerLeagueSeason({
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
    const preview = await app.previewHistoricalImportSource({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2026,player-puka",
      now,
    });
    await app.commitHistoricalImport({
      actorSessionToken: cam.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const pricing = await app.rebuildLeaguePricing({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      now: new Date(now.getTime() + 2_000),
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 4,
      seedPrefix: "file-store-job",
      idempotencyKey: "file-store-job",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    const job = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      idempotencyKey: "job:file-store-job",
      now: new Date(now.getTime() + 3_000),
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_export_artifact",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: room.revision,
      idempotencyKey: "start:room_export_artifact",
      now: new Date(now.getTime() + 3_500),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:70",
      sale: "cam puka 70",
      now: new Date(now.getTime() + 3_750),
    });
    await app.endLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "end:room_export_artifact",
      now: new Date(now.getTime() + 3_900),
    });
    const exportArtifact = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 4_000),
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loadedFileStore.store, simulationRunner: mockRunner });
    const loadedSnapshot = loadedFileStore.store.snapshot();

    expect(loadedSnapshot.historicalImportBatches).toEqual([
      expect.objectContaining({ id: preview.batch.id, status: "committed" }),
    ]);
    expect(loadedSnapshot.historicalSaleRecords).toEqual([
      expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 }),
    ]);
    expect(await loadedApp.listLeaguePricingSnapshots({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
    })).toEqual(pricing.snapshots);
    await expect(loadedApp.getJob({
      actorSessionToken: cam.sessionToken,
      jobId: job.id,
    })).resolves.toEqual(job);
    expect(loadedSnapshot.exportArtifacts).toEqual([exportArtifact.artifact]);
    expect(loadedSnapshot.exportArtifactContents).toEqual([
      {
        artifactId: exportArtifact.artifact.id,
        contentBase64: exportArtifact.content.toString("base64"),
      },
    ]);
    expect(loadedSnapshot.exportArtifacts[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("keeps generic job JSON date-like fields as JSON strings after a file roundtrip", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const job = fileStore.store.jobs.submit({
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "league_214674-season-2026",
      kind: "simulation",
      idempotencyKey: "job-json-date",
      inputJson: {
        nested: {
          updatedAt: "2026-08-09T12:00:00.000Z",
        },
      },
      now,
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const [loadedJob] = loadedFileStore.store.jobs.jobs();

    expect(loadedJob).toEqual({
      ...job,
      inputJson: {
        nested: {
          updatedAt: "2026-08-09T12:00:00.000Z",
        },
      },
    });
    expect(loadedJob?.createdAt).toBeInstanceOf(Date);
    expect(loadedJob?.updatedAt).toBeInstanceOf(Date);
  });
});
