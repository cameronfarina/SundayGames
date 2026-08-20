import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder, type Position } from "../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";
import {
  FilePlatformStore,
  migrateLegacyPlatformAuthSnapshot,
  writePlatformStoreSnapshot,
} from "../src/platform/filePlatformStore.js";
import { createPlatformApp } from "../src/platform/platformApp.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
];

const completeInitialRostersFor = (
  season: LeagueSeason,
): LiveDraftRoomInitialRosterPlayer[] => {
  const positions: readonly Position[] = [
    "QB", "QB", "QB", "RB", "RB", "RB", "RB", "WR",
    "WR", "WR", "WR", "WR", "TE", "TE", "K", "DST",
  ];

  return season.teams.flatMap(team => positions.map((position, index): LiveDraftRoomInitialRosterPlayer => ({
    teamId: team.id,
    playerName: `${team.id} ${position} ${index + 1}`,
    position,
    price: 1,
    expectedPrice: 1,
    source: "imported",
  })));
};

const baselinePrices: readonly PricingSourcePrice[] = [
  { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
];

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value;
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

  it("rejects malformed workspace snapshots at the file boundary", async () => {
    const path = await storePath();
    await writeFile(path, JSON.stringify({ memberships: "not-an-array" }), "utf8");

    await expect(FilePlatformStore.load(path)).rejects.toThrow(
      "Invalid platform store snapshot at memberships",
    );
  });

  it("rejects malformed auth sidecars at the file boundary", async () => {
    const path = await storePath();
    await writeFile(`${path}.auth.json`, JSON.stringify({
      schemaVersion: 1,
      auth: {
        accountCredentials: [],
        sessions: [{ id: "session-1" }],
      },
    }), "utf8");

    await expect(FilePlatformStore.load(path)).rejects.toThrow(
      "Invalid platform store snapshot at auth.sessions[0].accountId",
    );
  });

  it("accepts an auth sidecar envelope before auth has been persisted", async () => {
    const path = await storePath();
    await writeFile(`${path}.auth.json`, JSON.stringify({ schemaVersion: 1 }), "utf8");

    const loaded = await FilePlatformStore.load(path);

    expect(loaded.store.snapshot().auth).toEqual({ accountCredentials: [], sessions: [] });
  });

  it("propagates filesystem errors other than missing files", async () => {
    const path = await storePath();
    await mkdir(path);

    await expect(FilePlatformStore.load(path)).rejects.toThrow();
  });

  it("cleans interrupted atomic writes and continues the serialized save queue", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    await mkdir(path);

    await expect(fileStore.save()).rejects.toThrow();
    if (directory === undefined) throw new Error("Expected a temporary directory.");
    expect((await readdir(directory)).some(name => name.endsWith(".tmp"))).toBe(false);

    await rm(path, { recursive: true });
    await fileStore.save();

    await expect(FilePlatformStore.load(path)).resolves.toBeInstanceOf(FilePlatformStore);
  });

  it("roundtrips a registered league season and active auth session", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
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

    expect(await loadedApp.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id, now })).toEqual(season);
    expect(loadedSnapshot.auth.accountCredentials[0]?.account.createdAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.accountCredentials[0]?.account.updatedAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.sessions[0]?.createdAt).toBeInstanceOf(Date);
    expect(loadedSnapshot.auth.sessions[0]?.expiresAt).toBeInstanceOf(Date);
  });

  it("roundtrips a live room sale with revived room and event dates", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_100001_2026",
      viewerPasswordHashRef: "viewer-password-hash",
      startsAt: new Date(now.getTime() + 60_000),
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start:room_100001_2026",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });

    await fileStore.save();
    const loadedFileStore = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loadedFileStore.store, simulationRunner: mockRunner });
    const loadedRoom = await loadedApp.getLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
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

  it("saves auth token hashes only in the auth sidecar without raw session tokens", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");

    await fileStore.save();
    const savedWorkspace = await readFile(path, "utf8");
    const savedAuth = await readFile(fileStore.authPath, "utf8");
    const savedJson: unknown = JSON.parse(savedAuth);
    const savedRoot = asRecord(savedJson, "saved auth sidecar");
    const auth = asRecord(savedRoot.auth, "auth");
    if (!Array.isArray(auth.sessions)) throw new Error("Expected auth.sessions to be an array.");
    const firstSession = asRecord(auth.sessions[0], "first session");

    expect(firstSession.tokenHash).toBe(owner11.session.tokenHash);
    expect(asRecord(JSON.parse(savedWorkspace), "saved workspace").auth).toEqual({
      accountCredentials: [],
      sessions: [],
    });
    expect(savedWorkspace).not.toContain(owner11.sessionToken);
    expect(savedAuth).not.toContain(owner11.sessionToken);
    expect(savedAuth).not.toContain("sessionToken");
    expect(savedAuth).not.toContain("owner11 password!");
  });

  it("does not restore stale credentials when the auth sidecar is missing", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    await fileStore.save();

    await rm(fileStore.authPath);
    const loaded = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loaded.store, simulationRunner: mockRunner });

    await expect(loadedApp.findAccountBySessionToken(owner11.sessionToken, now)).resolves.toBeNull();
    expect(loaded.store.snapshot().auth).toEqual({ accountCredentials: [], sessions: [] });
  });

  it("migrates legacy embedded auth into the sidecar and redacts the workspace", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    await writePlatformStoreSnapshot(path, fileStore.store.snapshot());

    const loaded = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loaded.store, simulationRunner: mockRunner });
    const migratedWorkspace = asRecord(JSON.parse(await readFile(path, "utf8")), "migrated workspace");

    await expect(loadedApp.findAccountBySessionToken(owner11.sessionToken, now)).resolves.toMatchObject({
      email: "owner11@example.com",
    });
    expect(migratedWorkspace.auth).toEqual({ accountCredentials: [], sessions: [] });
    await expect(readFile(loaded.authPath, "utf8")).resolves.toContain(owner11.session.tokenHash);
  });

  it("preserves legacy credentials in the sidecar when workspace redaction is interrupted", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    await rm(path, { force: true });
    await mkdir(path);

    await expect(migrateLegacyPlatformAuthSnapshot(path, fileStore.store.snapshot())).rejects.toThrow();

    await expect(readFile(fileStore.authPath, "utf8")).resolves.toContain(owner11.session.tokenHash);
  });

  it("persists auth changes in a small sidecar without rewriting the workspace snapshot", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    await fileStore.save();
    const workspaceBefore = await readFile(path, "utf8");

    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    const workspaceSnapshot = vi.spyOn(fileStore.store, "snapshot");
    await fileStore.saveAuth();

    expect(workspaceSnapshot).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe(workspaceBefore);
    expect((await readFile(fileStore.authPath, "utf8")).length).toBeLessThan(10_000);

    const loaded = await FilePlatformStore.load(path);
    const loadedApp = createPlatformApp({ store: loaded.store, simulationRunner: mockRunner });
    await expect(loadedApp.findAccountBySessionToken(owner11.sessionToken, now)).resolves.toMatchObject({
      email: "owner11@example.com",
    });
  });

  it("roundtrips private simulation and mock draft session state", async () => {
    const path = await storePath();
    const fileStore = new FilePlatformStore(path);
    const app = createPlatformApp({ store: fileStore.store, simulationRunner: mockRunner });
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 4,
      seedPrefix: "file-store-sim",
      idempotencyKey: "file-store-sim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    const completedSimulation = await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 1_000),
    });
    const storedSimulation = fileStore.store.simulations.find(simulation.id);
    if (storedSimulation.result === undefined) throw new Error("Expected completed simulation result.");
    storedSimulation.result.favoriteRunNumbers = [1];
    const favoritedSimulation = await app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 1_500),
    });
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 4, label: "File store mock" },
      now,
    });
    const updatedMockSession = await app.appendMockDraftCommand({
      actorSessionToken: owner11.sessionToken,
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
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now,
    })).resolves.toEqual(favoritedSimulation);
    expect(completedSimulation.result?.favoriteRunNumbers).toBeUndefined();
    expect(await loadedApp.listMockDraftSessions({
      actorSessionToken: owner11.sessionToken,
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
    await app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await app.login({ email: "owner11@example.com", password: "owner11 password!", now });
    if (owner11 === null) throw new Error("Expected login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const preview = await app.previewHistoricalImportSource({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,70,2026,player-puka",
      now,
    });
    await app.commitHistoricalImport({
      actorSessionToken: owner11.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const pricing = await app.rebuildLeaguePricing({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      now: new Date(now.getTime() + 2_000),
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 4,
      seedPrefix: "file-store-job",
      idempotencyKey: "file-store-job",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    const job = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      idempotencyKey: "job:file-store-job",
      now: new Date(now.getTime() + 3_000),
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_export_artifact",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      initialRosters: completeInitialRostersFor(season),
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: room.revision,
      idempotencyKey: "start:room_export_artifact",
      now: new Date(now.getTime() + 3_500),
    });
    await app.endLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "end:room_export_artifact",
      now: new Date(now.getTime() + 3_900),
    });
    const exportArtifact = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner11.sessionToken,
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
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
    })).toEqual(pricing.snapshots);
    await expect(loadedApp.getJob({
      actorSessionToken: owner11.sessionToken,
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
      leagueId: "league_100001",
      seasonId: "league_100001-season-2026",
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
