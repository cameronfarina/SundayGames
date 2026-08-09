import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  InMemoryPlatformStore,
  PlatformAppError,
  createPlatformApp,
} from "../src/platform/platformApp.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

const baselinePrices = [
  { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
  { name: "Bijan Robinson", normalizedName: "bijan robinson", position: "RB", price: 50 },
] as const satisfies readonly PricingSourcePrice[];

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

const signUpAndLogin = (
  app: ReturnType<typeof createPlatformApp>,
  email: string,
  password: string,
  createdAt: Date,
) => {
  app.createAccount({ email, password, now: createdAt });
  const login = app.login({ email, password, now: createdAt });
  if (login === null) throw new Error(`Expected ${email} login.`);

  return login;
};

describe("platform app service", () => {
  it("requires an owner or admin actor when registering league season data", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    expect(() =>
      app.registerLeagueSeason({
        actorSessionToken: cam.sessionToken,
        season,
        memberships: [
          {
            userId: cam.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    ).toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
  });

  it("registers a league season, gates shared access by membership, and keeps prep private", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const outsider = signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    expect(registeredSeason).toEqual(season);
    expect(registeredSeason).not.toBe(season);
    expect(app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season.id })).toEqual(season);
    expect(() =>
      app.getLeagueSeason({ actorSessionToken: outsider.sessionToken, seasonId: season.id }),
    ).toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));

    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
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
    });
    const simulationJob = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      idempotencyKey: "job:cam-puka-plan",
      now,
    });

    expect(simulationJob).toMatchObject({
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      kind: "simulation",
      status: "queued",
    });
    await expect(app.listJobs({ actorSessionToken: cam.sessionToken })).resolves.toEqual([simulationJob]);
    await expect(app.listJobs({ actorSessionToken: seth.sessionToken })).resolves.toEqual([]);
    await expect(app.cancelJob({
      actorSessionToken: seth.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 500),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));
    await expect(app.cancelJob({
      actorSessionToken: cam.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 750),
    })).resolves.toMatchObject({
      id: simulationJob.id,
      status: "canceled",
      cancellationRequestedAt: new Date(now.getTime() + 750),
      finishedAt: new Date(now.getTime() + 750),
    });
    await expect(app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "canceled",
      result: undefined,
    });
    const rerunJob = await app.rerunJob({
      actorSessionToken: cam.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-cam-puka-plan",
      now: new Date(now.getTime() + 800),
    });
    const rerunAgain = await app.rerunJob({
      actorSessionToken: cam.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-cam-puka-plan",
      now: new Date(now.getTime() + 850),
    });

    expect(rerunJob).toMatchObject({
      id: expect.stringMatching(/^job_/),
      status: "queued",
      kind: "simulation",
      inputJson: simulationJob.inputJson,
      idempotencyKey: `rerun:${simulationJob.id}:rerun-cam-puka-plan`,
    });
    expect(rerunJob.id).not.toBe(simulationJob.id);
    expect(rerunAgain).toEqual(rerunJob);
    await expect(app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "requested",
      result: undefined,
    });
    const completedRerunSimulation = await app.executeSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 860),
    });
    const rerunAfterCompletion = await app.rerunJob({
      actorSessionToken: cam.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-cam-puka-plan",
      now: new Date(now.getTime() + 870),
    });
    expect(completedRerunSimulation.status).toBe("completed");
    expect(rerunAfterCompletion).toEqual(rerunJob);
    await expect(app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: expect.objectContaining({ runCount: 25 }),
    });
    await expect(app.rerunJob({
      actorSessionToken: seth.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "seth-rerun",
      now: new Date(now.getTime() + 875),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));

    const executableSimulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 25,
      seedPrefix: "cam-puka-plan-direct",
      idempotencyKey: "cam-puka-plan-direct",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" },
        ],
      },
      now: new Date(now.getTime() + 800),
    });
    const completed = await app.executeSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: executableSimulation.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.result).toMatchObject({
      runCount: 25,
      forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
    });
    expect((await app.listSimulationRuns({ actorSessionToken: cam.sessionToken })).map(run => run.status)).toEqual([
      "completed",
      "completed",
    ]);
    await expect(app.listSimulationRuns({ actorSessionToken: seth.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: seth.sessionToken, runId: executableSimulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_resource", "This prep artifact belongs to another user."));
  });

  it("lets a server worker execute an existing simulation while preserving private team ownership checks", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan",
      idempotencyKey: "worker-plan",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });

    const completed = await app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.status).toBe("completed");
    expect(completed.result).toMatchObject({
      runCount: 10,
      forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
    });
    await expect(app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: seth.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_500),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const blockedSimulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan-stale-claim",
      idempotencyKey: "worker-plan-stale-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: beatonTeam.ownerId,
          teamId: beatonTeam.id,
        },
      ],
    });

    await expect(app.executeSimulationRunForWorker({
      runId: blockedSimulation.id,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_team_required",
      "Private prep can only use your claimed team.",
    ));
  });

  it("blocks outsider setup overwrites and replaces omitted league memberships", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const outsider = signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || sethTeam === undefined || beatonTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    expect(() =>
      app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: beatonTeam.ownerId,
            teamId: beatonTeam.id,
          },
        ],
      }),
    ).toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id })).toEqual(season);

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    expect(() =>
      app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id }),
    ).toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));
  });

  it("runs shared historical imports and league pricing rebuilds behind commissioner permissions", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const importSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
      seasonYear: 2025,
    });
    const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const importCamTeam = importSeason.teams.find(team => team.ownerDisplayName === "Cam");
    const draftCamTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Cam");
    const draftSethTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Seth");
    if (importCamTeam === undefined || draftCamTeam === undefined || draftSethTeam === undefined) throw new Error("Expected fixture teams.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: importSeason,
      memberships: [
        { userId: cam.account.id, leagueId: importSeason.leagueId, role: "owner", ownerId: importCamTeam.ownerId, teamId: importCamTeam.id },
      ],
      now,
    });
    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: draftSeason,
      memberships: [
        { userId: cam.account.id, leagueId: draftSeason.leagueId, role: "owner", ownerId: draftCamTeam.ownerId, teamId: draftCamTeam.id },
        { userId: seth.account.id, leagueId: draftSeason.leagueId, role: "member", ownerId: draftSethTeam.ownerId, teamId: draftSethTeam.id },
      ],
      now,
    });

    expect(() =>
      app.previewHistoricalImportSource({
        actorSessionToken: seth.sessionToken,
        leagueId: importSeason.leagueId,
        seasonYear: importSeason.seasonYear,
        sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2025,player-puka",
        now,
      }),
    ).toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const preview = app.previewHistoricalImportSource({
      actorSessionToken: cam.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2025,player-puka",
      now,
    });
    const committed = app.commitHistoricalImport({
      actorSessionToken: cam.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const replacementPreview = app.previewHistoricalImportSource({
      actorSessionToken: cam.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,90,2025,player-puka",
      replacementRequested: true,
      now: new Date(now.getTime() + 1_500),
    });
    app.commitHistoricalImport({
      actorSessionToken: cam.sessionToken,
      batchId: replacementPreview.batch.id,
      now: new Date(now.getTime() + 1_750),
    });
    const pricing = app.rebuildLeaguePricing({
      actorSessionToken: cam.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
      modelVersion: "league-calibration-v1",
      scenarioIds: ["balanced"],
      baselinePrices,
      now: new Date(now.getTime() + 2_000),
    });

    expect(committed.committedRecords).toEqual([
      expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 }),
    ]);
    expect(pricing.snapshots[0]?.rows.find(row => row.playerName === "Puka Nacua")).toMatchObject({
      marketPrice: 70,
      scenarioPrice: 70,
    });
    expect(app.listLeaguePricingSnapshots({
      actorSessionToken: seth.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
    })).toEqual(pricing.snapshots);
  });

  it("blocks outsider registration for a new season in an existing league", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const outsider = signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season2026 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const season2027 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
      seasonYear: 2027,
    });
    const camTeam = season2026.teams.find(team => team.ownerDisplayName === "Cam");
    const outsiderTeam = season2027.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || outsiderTeam === undefined) throw new Error("Expected fixture teams.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: season2026,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season2026.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
    });

    expect(() =>
      app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season: season2027,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: season2027.leagueId,
            role: "owner",
            ownerId: outsiderTeam.ownerId,
            teamId: outsiderTeam.id,
          },
        ],
      }),
    ).toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season2026.id })).toEqual(season2026);
  });

  it("returns copies of shared league and live room state", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    registeredSeason.setupStatus = "draft";
    season.setupStatus = "draft";

    expect(app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id }).setupStatus).toBe("published");

    const room = app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_copy_test",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    room.status = "ended";

    const freshRoom = app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId });
    expect(freshRoom).not.toBe(room);
    expect(freshRoom.status).toBe("setup");
  });

  it("runs mock draft sessions through revision and command-count guards", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    const session = app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
      now,
    });
    const appended = app.appendMockDraftCommand({
      actorSessionToken: cam.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      command: "draft puka for 62",
      idempotencyKey: "mock:puka:62",
      now: new Date(now.getTime() + 1_000),
    });

    expect(app.listMockDraftSessions({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
    })).toEqual([appended]);

    const reset = app.resetMockDraftSession({
      actorSessionToken: cam.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      now: new Date(now.getTime() + 2_000),
    });

    expect(reset.revision).toBe(2);
    expect(reset.commandLog).toEqual([]);
    expect(() =>
      app.appendMockDraftCommand({
        actorSessionToken: cam.sessionToken,
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_stale",
        command: "draft ladd for 21",
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow();
  });

  it("rechecks current team claims before reading or mutating private prep", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 5,
      seedPrefix: "old-claim",
      idempotencyKey: "old-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    const mockSession = app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: beatonTeam.ownerId,
          teamId: beatonTeam.id,
        },
      ],
    });

    await expect(app.listSimulationRuns({ actorSessionToken: cam.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: cam.sessionToken, runId: simulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
    expect(() =>
      app.appendMockDraftCommand({
        actorSessionToken: cam.sessionToken,
        sessionId: mockSession.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_after_claim_change",
        command: "draft puka for 62",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
  });

  it("routes live room commands through commissioner authorization and exports one draft sheet", () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    const room = app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_214674_2026",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
      ],
      now,
    });

    expect(app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId })).toEqual(room);
    expect(app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId })).not.toBe(room);
    expect(() =>
      app.startLiveDraftRoom({
        actorSessionToken: seth.sessionToken,
        roomId: room.roomId,
        expectedRevision: 1,
        idempotencyKey: "start-by-seth",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 2_000),
    });
    const sold = app.logLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 3_000),
    });

    expect(sold.projection.teams.find(team => team.ownerDisplayName === "Cam")).toMatchObject({
      spent: 112,
      budgetRemaining: 88,
    });

    const exportResult = app.exportLiveDraftRoom({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 4_000),
    });
    const artifactResult = app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 5_000),
    });
    const replayedArtifactResult = app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 6_000),
    });

    expect(exportResult.sheetName).toBe("Draft Results");
    expect(exportResult.table[0]?.slice(0, 2)).toEqual(["League", "League 214674"]);

    const teamHeaderRow = exportResult.table[5];
    if (teamHeaderRow === undefined) throw new Error("Expected team header row.");
    const camColumn = teamHeaderRow.indexOf("Cam");
    expect(camColumn).toBeGreaterThanOrEqual(0);

    const rb1Row = exportResult.table.find(row => row[0] === "RB1");
    const wr1Row = exportResult.table.find(row => row[0] === "WR1");
    expect(rb1Row?.slice(camColumn, camColumn + 3)).toEqual(["RB1", "De'Von Achane", 50]);
    expect(wr1Row?.slice(camColumn, camColumn + 3)).toEqual(["WR1", "Puka Nacua", 62]);
    expect(exportResult.csv).toContain("Puka Nacua,62");
    expect(artifactResult.artifact).toMatchObject({
      leagueId: season.leagueId,
      seasonId: season.id,
      roomId: room.roomId,
      sourceRevision: sold.revision,
      format: "csv",
      contentType: "text/csv; charset=utf-8",
    });
    expect(artifactResult.content.toString("utf8")).toContain("Puka Nacua,62");
    expect(replayedArtifactResult).toEqual(artifactResult);
  });
});
