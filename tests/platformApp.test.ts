import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactFormat,
  ExportArtifactRepository,
  SaveExportArtifactOptions,
} from "../src/platform/exportArtifacts.js";
import {
  InMemoryPlatformStore,
  PlatformAppError,
  createPlatformApp,
} from "../src/platform/platformApp.js";
import type {
  LeagueSetupRepository,
  RegisterLeagueSeasonRepositoryInput,
} from "../src/platform/leagueSetup.js";
import {
  InMemoryLiveDraftRoomRepository,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomRepository,
  type LogLiveDraftRoomSaleInput,
  type MutateLiveDraftRoomInput,
} from "../src/platform/liveDraftRooms.js";
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

const signUpAndLogin = async (
  app: ReturnType<typeof createPlatformApp>,
  email: string,
  password: string,
  createdAt: Date,
) => {
  await app.createAccount({ email, password, now: createdAt });
  const login = await app.login({ email, password, now: createdAt });
  if (login === null) throw new Error(`Expected ${email} login.`);

  return login;
};

class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();
  readonly registerInputs: RegisterLeagueSeasonRepositoryInput[] = [];

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    this.registerInputs.push(structuredClone(input));

    return this.inner.registerLeagueSeason(input);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async findLeagueSeason(seasonId: string) {
    return this.inner.findLeagueSeason(seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string) {
    return this.inner.hasLeagueSeasonForLeague(leagueId);
  }

  async findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
  }

  async findMembership(userId: string, leagueId: string) {
    return this.inner.findMembership(userId, leagueId);
  }

  async membershipsForLeague(leagueId: string) {
    return this.inner.membershipsForLeague(leagueId);
  }
}

class AsyncLiveDraftRoomRepository implements LiveDraftRoomRepository {
  readonly inner = new InMemoryLiveDraftRoomRepository();

  async createRoom(input: CreateLiveDraftRoomInput) {
    return this.inner.createRoom(input);
  }

  async getRoom(roomId: string) {
    return this.inner.getRoom(roomId);
  }

  async getRoomForActor(input: { roomId: string; actor: Parameters<LiveDraftRoomRepository["getRoomForActor"]>[0]["actor"] }) {
    return this.inner.getRoomForActor(input);
  }

  async hasStartedRoomForSeason(seasonId: string) {
    return this.inner.hasStartedRoomForSeason(seasonId);
  }

  async startRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.startRoom(input);
  }

  async pauseRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.pauseRoom(input);
  }

  async resumeRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.resumeRoom(input);
  }

  async logSaleCommand(input: LogLiveDraftRoomSaleInput) {
    return this.inner.logSaleCommand(input);
  }

  async correctSale(input: Parameters<LiveDraftRoomRepository["correctSale"]>[0]) {
    return this.inner.correctSale(input);
  }

  async undoLastSale(input: MutateLiveDraftRoomInput) {
    return this.inner.undoLastSale(input);
  }

  async endRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.endRoom(input);
  }
}

class RecordingExportArtifactRepository implements ExportArtifactRepository {
  savedByUserIds: string[] = [];
  savedResults: DraftExportArtifactResult[] = [];

  async save(
    result: DraftExportArtifactResult,
    options?: SaveExportArtifactOptions | undefined,
  ): Promise<DraftExportArtifactResult> {
    this.savedByUserIds.push(options?.createdByUserId ?? "");
    this.savedResults.push({
      artifact: structuredClone(result.artifact),
      content: Buffer.from(result.content),
    });

    return {
      artifact: structuredClone(result.artifact),
      content: Buffer.from(result.content),
    };
  }

  async get(_id: string): Promise<DraftExportArtifactResult | undefined> {
    return undefined;
  }

  async findByRoomRevision(
    _roomId: string,
    _sourceRevision: number,
    _format?: ExportArtifactFormat | undefined,
  ): Promise<DraftExportArtifactResult | undefined> {
    return undefined;
  }

  async listByRoom(_roomId: string): Promise<readonly ExportArtifact[]> {
    return [];
  }
}

describe("platform app service", () => {
  it("requires an owner or admin actor when registering league season data", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    await expect(app.registerLeagueSeason({
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
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
  });

  it("uses an injected async league setup repository for season reads and registration", async () => {
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      leagueSetupRepository,
      simulationRunner: mockRunner,
    });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const nextSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      seasonYear: season.seasonYear + 1,
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    const nextCamTeam = nextSeason.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined || sethTeam === undefined || nextCamTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
      createdByUserId: cam.account.id,
      now,
    });

    expect(app.store.findLeagueSeason(season.id)).toBeNull();
    await expect(app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id, now })).resolves.toEqual(season);
    await expect(
      app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season: nextSeason,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: nextSeason.leagueId,
            role: "owner",
            ownerId: nextCamTeam.ownerId,
            teamId: nextCamTeam.id,
          },
        ],
        now,
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const registeredNextSeason = await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: nextSeason,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: nextSeason.leagueId,
          role: "owner",
          ownerId: nextCamTeam.ownerId,
          teamId: nextCamTeam.id,
        },
      ],
      now: new Date(now.getTime() + 1_000),
    });

    expect(registeredNextSeason).toEqual(nextSeason);
    expect(leagueSetupRepository.registerInputs.at(-1)).toMatchObject({
      season: nextSeason,
      createdByUserId: cam.account.id,
    });
    await expect(app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: nextSeason.id, now })).resolves.toEqual(nextSeason);
  });

  it("lets league members claim one current team without taking another user's team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const sam = await signUpAndLogin(app, "sam@example.com", "sam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Sam");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member" },
        { userId: sam.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: seth.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now,
    })).resolves.toMatchObject({
      userId: seth.account.id,
      leagueId: season.leagueId,
      role: "member",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: sam.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now,
    })).rejects.toThrow(new PlatformAppError(
      "team_already_claimed",
      "That team is already claimed.",
    ));

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: seth.sessionToken,
      seasonId: season.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({
      userId: seth.account.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
    });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: sam.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      userId: sam.account.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    });
  });

  it("locks an assigned team claim after a live draft has started", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Sam");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_claim_lock",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: room.revision,
      idempotencyKey: "start:claim-lock",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: seth.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ teamId: sethTeam.id, ownerId: sethTeam.ownerId });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: seth.sessionToken,
      seasonId: season.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new PlatformAppError(
      "team_claim_locked",
      "Your team claim is locked because this league's live draft has started.",
    ));
  });

  it("registers a league season, gates shared access by membership, and keeps prep private", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    expect(registeredSeason).toEqual(season);
    expect(registeredSeason).not.toBe(season);
    expect(await app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season.id })).toEqual(season);
    await expect(
      app.getLeagueSeason({ actorSessionToken: outsider.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
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
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
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

    await app.registerLeagueSeason({
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

  it("blocks outsider setup overwrites and replaces omitted league memberships", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
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

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    await expect(app.registerLeagueSeason({
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
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(await app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id })).toEqual(season);

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    await expect(
      app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));
  });

  it("runs shared historical imports and league pricing rebuilds behind commissioner permissions", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
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

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: importSeason,
      memberships: [
        { userId: cam.account.id, leagueId: importSeason.leagueId, role: "owner", ownerId: importCamTeam.ownerId, teamId: importCamTeam.id },
      ],
      now,
    });
    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season: draftSeason,
      memberships: [
        { userId: cam.account.id, leagueId: draftSeason.leagueId, role: "owner", ownerId: draftCamTeam.ownerId, teamId: draftCamTeam.id },
        { userId: seth.account.id, leagueId: draftSeason.leagueId, role: "member", ownerId: draftSethTeam.ownerId, teamId: draftSethTeam.id },
      ],
      now,
    });

    await expect(
      app.previewHistoricalImportSource({
        actorSessionToken: seth.sessionToken,
        leagueId: importSeason.leagueId,
        seasonYear: importSeason.seasonYear,
        sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2025,player-puka",
        now,
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const preview = await app.previewHistoricalImportSource({
      actorSessionToken: cam.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,70,2025,player-puka",
      now,
    });
    const committed = await app.commitHistoricalImport({
      actorSessionToken: cam.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const replacementPreview = await app.previewHistoricalImportSource({
      actorSessionToken: cam.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nCam,Puka Nacua,WR,90,2025,player-puka",
      replacementRequested: true,
      now: new Date(now.getTime() + 1_500),
    });
    await app.commitHistoricalImport({
      actorSessionToken: cam.sessionToken,
      batchId: replacementPreview.batch.id,
      now: new Date(now.getTime() + 1_750),
    });
    const pricing = await app.rebuildLeaguePricing({
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
    expect(await app.listLeaguePricingSnapshots({
      actorSessionToken: seth.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
    })).toEqual(pricing.snapshots);
  });

  it("blocks outsider registration for a new season in an existing league", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
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

    await app.registerLeagueSeason({
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

    await expect(app.registerLeagueSeason({
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
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(await app.getLeagueSeason({ actorSessionToken: cam.sessionToken, seasonId: season2026.id })).toEqual(season2026);
  });

  it("returns copies of shared league and live room state", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    registeredSeason.setupStatus = "draft";
    season.setupStatus = "draft";

    expect((await app.getLeagueSeason({ actorSessionToken: seth.sessionToken, seasonId: season.id })).setupStatus)
      .toBe("published");

    const room = await app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_copy_test",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    room.status = "ended";

    const freshRoom = await app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId });
    expect(freshRoom).not.toBe(room);
    expect(freshRoom.status).toBe("setup");
  });

  it("runs mock draft sessions through revision and command-count guards", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
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

    const session = await app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
      now,
    });
    const appended = await app.appendMockDraftCommand({
      actorSessionToken: cam.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      command: "draft puka for 62",
      idempotencyKey: "mock:puka:62",
      now: new Date(now.getTime() + 1_000),
    });

    expect(await app.listMockDraftSessions({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
    })).toEqual([appended]);

    const reset = await app.resetMockDraftSession({
      actorSessionToken: cam.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      now: new Date(now.getTime() + 2_000),
    });

    expect(reset.revision).toBe(2);
    expect(reset.commandLog).toEqual([]);
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: cam.sessionToken,
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_stale",
        command: "draft ladd for 21",
        now: new Date(now.getTime() + 3_000),
      }),
    ).rejects.toThrow();
  });

  it("rejects mock draft result references to another user's private simulation", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const sethSimulation = await app.createSimulationRun({
      actorSessionToken: seth.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      count: 5,
      seedPrefix: "seth-private-run",
      idempotencyKey: "seth-private-run",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await app.executeSimulationRun({
      actorSessionToken: seth.sessionToken,
      runId: sethSimulation.id,
      now: new Date(now.getTime() + 500),
    });
    const camSession = await app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    await expect(app.appendMockDraftCommand({
      actorSessionToken: cam.sessionToken,
      sessionId: camSession.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_leak",
      command: "show seth result",
      idempotencyKey: "mock:leak",
      latestResultRef: { kind: "simulation-result", id: sethSimulation.id },
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const [storedSession] = await app.listMockDraftSessions({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
    });
    expect(storedSession).toMatchObject({
      id: camSession.id,
      latestResultRef: undefined,
      commandLog: [],
    });
  });

  it("rechecks current team claims before reading or mutating private prep", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Beaton");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
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
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    await app.registerLeagueSeason({
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
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: cam.sessionToken,
        sessionId: mockSession.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_after_claim_change",
        command: "draft puka for 62",
        now: new Date(now.getTime() + 1_000),
      }),
    ).rejects.toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
  });

  it("routes live room commands through commissioner authorization and exports one draft sheet", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    const room = await app.createLiveDraftRoom({
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

    expect(await app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId })).toEqual(room);
    expect(await app.getLiveDraftRoom({ actorSessionToken: seth.sessionToken, roomId: room.roomId })).not.toBe(room);
    await expect(
      app.startLiveDraftRoom({
        actorSessionToken: seth.sessionToken,
        roomId: room.roomId,
        expectedRevision: 1,
        idempotencyKey: "start-by-seth",
        now: new Date(now.getTime() + 1_000),
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 2_000),
    });
    const sold = await app.logLiveDraftSale({
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

    const memberState = await app.getLiveDraftRoomState({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
    });
    expect(memberState).toMatchObject({
      role: "member",
      canMutateRoom: false,
      selectedTeam: { teamId: sethTeam.id },
      connection: { state: "synchronized", revision: sold.revision },
    });
    expect(JSON.stringify(memberState)).not.toContain("viewerPasswordHashRef");

    const paused = await app.pauseLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "pause-room",
      now: new Date(now.getTime() + 4_000),
    });
    await expect(app.resumeLiveDraftRoom({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room-by-member",
      now: new Date(now.getTime() + 5_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    const resumed = await app.resumeLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room",
      now: new Date(now.getTime() + 6_000),
    });
    const pukaSale = resumed.projection.sales.find(sale => sale.playerName === "Puka Nacua");
    if (pukaSale === undefined) throw new Error("Expected Puka sale fixture.");
    const corrected = await app.correctLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: resumed.revision,
      idempotencyKey: "correct-puka-sale",
      saleEventId: pukaSale.saleEventId,
      replacementSale: "seth puka 41",
      now: new Date(now.getTime() + 7_000),
    });
    expect(corrected.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Seth", playerName: "Puka Nacua", price: 41 }),
    ]);
    const restored = await app.undoLastLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: corrected.revision,
      idempotencyKey: "undo-puka-correction",
      now: new Date(now.getTime() + 8_000),
    });
    expect(restored.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Cam", playerName: "Puka Nacua", price: 62 }),
    ]);

    const exportResult = await app.exportLiveDraftRoom({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 9_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 10_000),
    })).rejects.toThrow(new PlatformAppError(
      "draft_room_not_final",
      "Draft room must be ended before creating a final export artifact.",
    ));
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: room.roomId,
      expectedRevision: restored.revision,
      idempotencyKey: "end-room-before-export",
      now: new Date(now.getTime() + 11_000),
    });
    const artifactResult = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 12_000),
    });
    const replayedArtifactResult = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 13_000),
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
      sourceRevision: ended.revision,
      format: "csv",
      contentType: "text/csv; charset=utf-8",
    });
    expect(artifactResult.content.toString("utf8")).toContain("Puka Nacua,62");
    expect(replayedArtifactResult).toEqual(artifactResult);
  });

  it("can route live draft rooms and export artifacts through injected async repositories", async () => {
    const liveDraftRoomRepository = new AsyncLiveDraftRoomRepository();
    const exportArtifactRepository = new RecordingExportArtifactRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      exportArtifactRepository,
      simulationRunner: mockRunner,
    });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const seth = await signUpAndLogin(app, "seth@example.com", "seth password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        { userId: cam.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: seth.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const created = await app.createLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      seasonId: season.id,
      roomId: "room_async_repo",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: created.roomId,
      expectedRevision: created.revision,
      idempotencyKey: "start-async-repo-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: cam.sessionToken,
      roomId: created.roomId,
      expectedRevision: 2,
      idempotencyKey: "async-repo-sale-puka",
      sale: "cam puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: cam.sessionToken,
      roomId: created.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "end-async-repo-room",
      now: new Date(now.getTime() + 3_000),
    });
    const artifactResult = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: seth.sessionToken,
      roomId: created.roomId,
      exportedAt: new Date(now.getTime() + 4_000),
    });

    expect(ended.revision).toBe(4);
    expect(artifactResult.content.toString("utf8")).toContain("Puka Nacua,62");
    expect(exportArtifactRepository.savedByUserIds).toEqual([seth.account.id]);
    expect(exportArtifactRepository.savedResults[0]?.artifact.sourceRevision).toBe(ended.revision);
    expect(app.store.liveDraftRooms.rooms()).toEqual([]);
    expect(app.store.exportArtifacts.artifacts()).toEqual([]);
  });
});
