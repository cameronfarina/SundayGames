import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
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
import { JobError } from "../src/platform/jobs.js";
import {
  LeagueCreationLimitError,
  type LeagueCreationLimits,
  type LeagueSetupRepository,
  type RegisterLeagueSeasonRepositoryInput,
} from "../src/platform/leagueSetup.js";
import {
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomRepository,
  type LogLiveDraftRoomSaleInput,
  type MutateLiveDraftRoomInput,
} from "../src/platform/liveDraftRooms.js";
import {
  InMemorySimulationRepository,
  type SimulationMockBatchRunner,
  type SimulationResult,
} from "../src/platform/simulations.js";
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

const asSnakeSeason = (season: LeagueSeason): LeagueSeason => ({
  ...season,
  settings: {
    expectedTeamCount: season.settings.expectedTeamCount,
    draftFormat: "snake",
    scoring: season.settings.scoring,
    snake: {
      rounds: season.settings.roster.rosterSize,
      order: season.teams.map(team => team.id),
      reversal: "standard",
    },
    roster: season.settings.roster,
    keeperPolicy: season.settings.keeperPolicy,
  },
});

const seasonForLeague = (key: string): LeagueSeason => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: `League ${key}`,
    setupStatus: "draft",
  });
  const leagueId = `league-${key}`;
  const seasonId = `season-${key}`;

  return {
    ...season,
    id: seasonId,
    leagueId,
    league: { ...season.league, id: leagueId, externalLeagueId: key },
    teams: season.teams.map(team => ({
      ...team,
      id: `${team.id}-${key}`,
      leagueSeasonId: seasonId,
    })),
  };
};

const strictLeagueCreationLimits: LeagueCreationLimits = {
  maxActiveLeaguesPerAccount: 1,
  maxCreatedLeaguesPerWindow: 1,
  creationWindowMs: 60 * 60 * 1_000,
};

class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();
  readonly registerInputs: RegisterLeagueSeasonRepositoryInput[] = [];

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    this.registerInputs.push(structuredClone(input));

    return this.inner.registerLeagueSeason(input);
  }

  async archiveLeague(input: Parameters<LeagueSetupRepository["archiveLeague"]>[0]) {
    return this.inner.archiveLeague(input);
  }

  async isLeagueArchived(leagueId: string) {
    return this.inner.isLeagueArchived(leagueId);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async joinLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["joinLeagueSeasonTeam"]>[0]) {
    return this.inner.joinLeagueSeasonTeam(input);
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
  readonly createInputs: CreateLiveDraftRoomInput[] = [];

  async createRoom(input: CreateLiveDraftRoomInput) {
    this.createInputs.push(structuredClone(input));
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

  async hasRoomForSeason(seasonId: string) {
    return this.inner.hasRoomForSeason(seasonId);
  }

  async synchronizeInitialRostersForSeason(
    input: Parameters<LiveDraftRoomRepository["synchronizeInitialRostersForSeason"]>[0],
  ) {
    return this.inner.synchronizeInitialRostersForSeason(input);
  }

  async cancelRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.cancelRoom(input);
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

  async reopenRoom(input: MutateLiveDraftRoomInput) {
    return this.inner.reopenRoom(input);
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

  async endRoom(input: Parameters<LiveDraftRoomRepository["endRoom"]>[0]) {
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
  it("persists active-league quotas and still permits updates to an existing league", () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const firstSeason = seasonForLeague("first");
    const createdByUserId = "account-owner11";
    const firstInput = {
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" as const }],
      createdByUserId,
      now,
    };

    expect(store.registerLeagueSeason(firstInput)).toEqual(firstSeason);
    expect(store.registerLeagueSeason({
      ...firstInput,
      season: { ...firstSeason, setupStatus: "published" },
      now: new Date(now.getTime() + 1),
    }).setupStatus).toBe("published");

    const restored = new InMemoryPlatformStore(store.snapshot(), {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const secondSeason = seasonForLeague("second");
    expect(() => restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 2),
    })).toThrow(new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    ));
  });

  it("persists league archives and releases only the active-league quota", () => {
    const limits: LeagueCreationLimits = {
      maxActiveLeaguesPerAccount: 1,
      maxCreatedLeaguesPerWindow: 10,
      creationWindowMs: 60 * 60 * 1_000,
    };
    const store = new InMemoryPlatformStore(undefined, { leagueCreationLimits: limits });
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("archived-first");
    store.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });

    expect(store.archiveLeague({
      leagueId: firstSeason.leagueId,
      archivedByUserId: createdByUserId,
      now: new Date(now.getTime() + 1),
    })).toBe(true);
    expect(store.isLeagueArchived(firstSeason.leagueId)).toBe(true);

    const restored = new InMemoryPlatformStore(store.snapshot(), { leagueCreationLimits: limits });
    expect(restored.isLeagueArchived(firstSeason.leagueId)).toBe(true);
    expect(restored.findLeagueSeason(firstSeason.id)).toEqual(firstSeason);

    const secondSeason = seasonForLeague("active-after-archive");
    expect(restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 2),
    })).toEqual(secondSeason);
  });

  it("enforces the durable per-account league creation window", () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: {
        ...strictLeagueCreationLimits,
        maxActiveLeaguesPerAccount: 10,
      },
    });
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("window-first");
    store.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });
    const secondSeason = seasonForLeague("window-second");

    expect(() => store.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 30_000),
    })).toThrow(new LeagueCreationLimitError(
      "league_creation_rate_limited",
      "Too many leagues were created recently. Try again later.",
      3_570,
    ));
  });

  it("restores active-league ownership from snapshots created before quota metadata", () => {
    const original = new InMemoryPlatformStore();
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("legacy-snapshot");
    original.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });
    const { leagueCreationRecords: _omittedCreationRecords, ...legacySnapshot } = original.snapshot();
    void _omittedCreationRecords;
    const restored = new InMemoryPlatformStore(legacySnapshot, {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const secondSeason = seasonForLeague("after-legacy-snapshot");

    expect(() => restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 1),
    })).toThrow(new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    ));
  });

  it("changes the signed-in account password and invalidates all active sessions", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const firstLogin = await signUpAndLogin(app, "password@example.com", "current secure password", now);
    const secondLogin = await app.login({
      email: firstLogin.account.email,
      password: "current secure password",
      now: new Date(now.getTime() + 1),
    });
    if (secondLogin === null) throw new Error("Expected second login.");
    const changedAt = new Date(now.getTime() + 2);

    await expect(app.changePassword({
      actorSessionToken: firstLogin.sessionToken,
      currentPassword: "current secure password",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now: changedAt,
    })).resolves.toEqual({
      account: { ...firstLogin.account, updatedAt: changedAt },
      revokedSessionCount: 2,
    });
    await expect(app.findAccountBySessionToken(firstLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(app.findAccountBySessionToken(secondLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
  });

  it("requires an owner or admin actor when registering league season data", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    await expect(app.registerLeagueSeason({
        actorSessionToken: owner11.sessionToken,
        season,
        memberships: [
          {
            userId: owner11.account.id,
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const nextSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      seasonYear: season.seasonYear + 1,
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const nextCamTeam = nextSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined || sethTeam === undefined || nextCamTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
      createdByUserId: owner11.account.id,
      now,
    });

    expect(app.store.findLeagueSeason(season.id)).toBeNull();
    await expect(app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id, now })).resolves.toEqual(season);
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
      actorSessionToken: owner11.sessionToken,
      season: nextSeason,
      memberships: [
        {
          userId: owner11.account.id,
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
      createdByUserId: owner11.account.id,
    });
    await expect(app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: nextSeason.id, now })).resolves.toEqual(nextSeason);
  });

  it("lets league members claim one current team without taking another user's team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const sam = await signUpAndLogin(app, "sam@example.com", "sam secure password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Owner12");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
        { userId: sam.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now,
    })).resolves.toMatchObject({
      userId: owner04.account.id,
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
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({
      userId: owner04.account.id,
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Owner12");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_claim_lock",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: room.revision,
      idempotencyKey: "start:claim-lock",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ teamId: sethTeam.id, ownerId: sethTeam.ownerId });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    expect(registeredSeason).toEqual(season);
    expect(registeredSeason).not.toBe(season);
    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id })).toEqual(season);
    await expect(
      app.getLeagueSeason({ actorSessionToken: outsider.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));

    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 25,
      seedPrefix: "owner11-puka-plan",
      idempotencyKey: "owner11-puka-plan",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" },
        ],
      },
      now,
    });
    const simulationJob = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      idempotencyKey: "job:owner11-puka-plan",
      now,
    });

    expect(simulationJob).toMatchObject({
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      kind: "simulation",
      status: "queued",
    });
    await expect(app.listJobs({ actorSessionToken: owner11.sessionToken })).resolves.toMatchObject({
      jobs: [expect.objectContaining({ id: simulationJob.id, kind: "simulation" })],
      nextCursor: undefined,
    });
    await expect(app.listJobs({ actorSessionToken: owner04.sessionToken })).resolves.toEqual({
      jobs: [],
      nextCursor: undefined,
    });
    await expect(app.cancelJob({
      actorSessionToken: owner04.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 500),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));
    await expect(app.cancelJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 750),
    })).resolves.toMatchObject({
      id: simulationJob.id,
      status: "canceled",
      cancellationRequestedAt: new Date(now.getTime() + 750),
      finishedAt: new Date(now.getTime() + 750),
    });
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "canceled",
      result: undefined,
    });
    const rerunJob = await app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-owner11-puka-plan",
      now: new Date(now.getTime() + 800),
    });
    await expect(app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "different-active-key",
      now: new Date(now.getTime() + 850),
    })).rejects.toThrow(new JobError(
      "job_already_active",
      "A rerun is already queued or running for this simulation.",
    ));

    expect(rerunJob).toMatchObject({
      id: expect.stringMatching(/^job_/),
      status: "queued",
      kind: "simulation",
      inputJson: simulationJob.inputJson,
      idempotencyKey: `simulation-rerun:${simulation.id}`,
    });
    expect(rerunJob.id).not.toBe(simulationJob.id);
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "requested",
      result: undefined,
    });
    const completedRerunSimulation = await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 860),
    });
    await app.cancelJob({
      actorSessionToken: owner11.sessionToken,
      jobId: rerunJob.id,
      now: new Date(now.getTime() + 865),
    });
    const rerunAfterCompletion = await app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-owner11-puka-plan",
      now: new Date(now.getTime() + 870),
    });
    expect(completedRerunSimulation.status).toBe("completed");
    expect(rerunAfterCompletion.id).toBe(rerunJob.id);
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "requested",
      result: undefined,
    });
    await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 872),
    });
    await expect(app.rerunJob({
      actorSessionToken: owner04.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "owner04-rerun",
      now: new Date(now.getTime() + 875),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));

    const executableSimulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 25,
      seedPrefix: "owner11-puka-plan-direct",
      idempotencyKey: "owner11-puka-plan-direct",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" },
        ],
      },
      now: new Date(now.getTime() + 800),
    });
    const completed = await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: executableSimulation.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.result).toMatchObject({
      runCount: 25,
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
    });
    expect((await app.listSimulationRuns({ actorSessionToken: owner11.sessionToken })).map(run => run.status)).toEqual([
      "completed",
      "completed",
    ]);
    await expect(app.listSimulationRuns({ actorSessionToken: owner04.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: owner04.sessionToken, runId: executableSimulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_resource", "This prep artifact belongs to another user."));
  });

  it("lets a server worker execute an existing simulation while preserving private team ownership checks", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan",
      idempotencyKey: "worker-plan",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });

    const completed = await app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.status).toBe("completed");
    expect(completed.result).toMatchObject({
      runCount: 10,
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
    });
    await expect(app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: owner04.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_500),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const blockedSimulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan-stale-claim",
      idempotencyKey: "worker-plan-stale-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: beatonTeam.ownerId,
          teamId: beatonTeam.id,
        },
      ],
    });

    await expect(app.executeSimulationRunForWorker({
      runId: blockedSimulation.id,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_team_required",
      "Private prep can only use your claimed team.",
    ));
  });

  it("marks a synchronous season simulation failed when completion persistence throws", async () => {
    class FailingCompletionRepository extends InMemorySimulationRepository {
      override complete(_runId: string, _result: SimulationResult): never {
        throw new Error("completion unavailable");
      }
    }

    const simulationRepository = new FailingCompletionRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "failed-season-sim@example.com", "owner11 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [{
        userId: owner11.account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
    });
    const run = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 1,
      seedPrefix: "failed-completion",
      idempotencyKey: "failed-completion",
      strategy: {},
      now,
    });
    const result: SimulationResult = {
      runId: run.id,
      requestId: run.request.id,
      completedAt: now,
      runCount: 1,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount: 1, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    };

    await expect(app.completeSeasonSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: run.id,
      result,
      now,
    })).rejects.toThrow("completion unavailable");
    expect(simulationRepository.find(run.id).status).toBe("failed");
  });

  it("blocks outsider setup overwrites and replaces omitted league memberships", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || sethTeam === undefined || beatonTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
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

    expect(await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id })).toEqual(season);

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    await expect(
      app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));
  });

  it("runs shared historical imports and league pricing rebuilds behind commissioner permissions", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const importSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2025,
    });
    const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const importCamTeam = importSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    const draftCamTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    const draftSethTeam = draftSeason.teams.find(team => team.ownerDisplayName === "Owner04");
    if (importCamTeam === undefined || draftCamTeam === undefined || draftSethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: importSeason,
      memberships: [
        { userId: owner11.account.id, leagueId: importSeason.leagueId, role: "owner", ownerId: importCamTeam.ownerId, teamId: importCamTeam.id },
      ],
      now,
    });
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: draftSeason,
      memberships: [
        { userId: owner11.account.id, leagueId: draftSeason.leagueId, role: "owner", ownerId: draftCamTeam.ownerId, teamId: draftCamTeam.id },
        { userId: owner04.account.id, leagueId: draftSeason.leagueId, role: "member", ownerId: draftSethTeam.ownerId, teamId: draftSethTeam.id },
      ],
      now,
    });

    await expect(
      app.previewHistoricalImportSource({
        actorSessionToken: owner04.sessionToken,
        leagueId: importSeason.leagueId,
        seasonYear: importSeason.seasonYear,
        sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,70,2025,player-puka",
        now,
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const preview = await app.previewHistoricalImportSource({
      actorSessionToken: owner11.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,70,2025,player-puka",
      now,
    });
    const committed = await app.commitHistoricalImport({
      actorSessionToken: owner11.sessionToken,
      batchId: preview.batch.id,
      now: new Date(now.getTime() + 1_000),
    });
    const replacementPreview = await app.previewHistoricalImportSource({
      actorSessionToken: owner11.sessionToken,
      leagueId: importSeason.leagueId,
      seasonYear: importSeason.seasonYear,
      sourceText: "owner,player,position,price,year,player id\nOwner11,Puka Nacua,WR,90,2025,player-puka",
      replacementRequested: true,
      now: new Date(now.getTime() + 1_500),
    });
    await app.commitHistoricalImport({
      actorSessionToken: owner11.sessionToken,
      batchId: replacementPreview.batch.id,
      now: new Date(now.getTime() + 1_750),
    });
    const pricing = await app.rebuildLeaguePricing({
      actorSessionToken: owner11.sessionToken,
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
      actorSessionToken: owner04.sessionToken,
      leagueId: draftSeason.leagueId,
      seasonYear: draftSeason.seasonYear,
    })).toEqual(pricing.snapshots);
  });

  it("blocks outsider registration for a new season in an existing league", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season2026 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const season2027 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2027,
    });
    const camTeam = season2026.teams.find(team => team.ownerDisplayName === "Owner11");
    const outsiderTeam = season2027.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || outsiderTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: season2026,
      memberships: [
        {
          userId: owner11.account.id,
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

    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season2026.id })).toEqual(season2026);
  });

  it("returns copies of shared league and live room state", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    registeredSeason.setupStatus = "draft";
    season.setupStatus = "draft";

    expect((await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id })).setupStatus)
      .toBe("published");

    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_copy_test",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    room.status = "ended";

    const freshRoom = await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId });
    expect(freshRoom).not.toBe(room);
    expect(freshRoom.status).toBe("setup");
  });

  it("runs mock draft sessions through revision and command-count guards", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
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

    const session = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
      now,
    });
    const appended = await app.appendMockDraftCommand({
      actorSessionToken: owner11.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      command: "draft puka for 62",
      idempotencyKey: "mock:puka:62",
      now: new Date(now.getTime() + 1_000),
    });

    expect(await app.listMockDraftSessions({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      now: new Date(now.getTime() + 1_000),
    })).toEqual([appended]);

    const reset = await app.resetMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      now: new Date(now.getTime() + 2_000),
    });

    expect(reset.revision).toBe(2);
    expect(reset.commandLog).toEqual([]);
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: owner11.sessionToken,
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const sethSimulation = await app.createSimulationRun({
      actorSessionToken: owner04.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      count: 5,
      seedPrefix: "owner04-private-run",
      idempotencyKey: "owner04-private-run",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    await app.executeSimulationRun({
      actorSessionToken: owner04.sessionToken,
      runId: sethSimulation.id,
      now: new Date(now.getTime() + 500),
    });
    const camSession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    await expect(app.appendMockDraftCommand({
      actorSessionToken: owner11.sessionToken,
      sessionId: camSession.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_leak",
      command: "show owner04 result",
      idempotencyKey: "mock:leak",
      latestResultRef: { kind: "simulation-result", id: sethSimulation.id },
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const [storedSession] = await app.listMockDraftSessions({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      now: new Date(now.getTime() + 1_000),
    });
    expect(storedSession).toMatchObject({
      id: camSession.id,
      latestResultRef: undefined,
      commandLog: [],
    });
  });

  it("rechecks current team claims before reading or mutating private prep", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 5,
      seedPrefix: "old-claim",
      idempotencyKey: "old-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: beatonTeam.ownerId,
          teamId: beatonTeam.id,
        },
      ],
    });

    await expect(app.listSimulationRuns({ actorSessionToken: owner11.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: owner11.sessionToken, runId: simulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: owner11.sessionToken,
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_100001_2026",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      initialRosters: [
        { teamId: camTeam.id, playerName: "De'Von Achane", position: "RB", price: 50, expectedPrice: 50 },
      ],
      now,
    });

    expect(await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId })).toEqual(room);
    expect(await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId })).not.toBe(room);
    await expect(
      app.startLiveDraftRoom({
        actorSessionToken: owner04.sessionToken,
        roomId: room.roomId,
        expectedRevision: 1,
        idempotencyKey: "start-by-owner04",
        now: new Date(now.getTime() + 1_000),
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 1,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 2_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 3_000),
    });

    expect(sold.projection.teams.find(team => team.ownerDisplayName === "Owner11")).toMatchObject({
      spent: 112,
      budgetRemaining: 88,
    });

    const memberState = await app.getLiveDraftRoomState({
      actorSessionToken: owner04.sessionToken,
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
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "pause-room",
      now: new Date(now.getTime() + 4_000),
    });
    await expect(app.resumeLiveDraftRoom({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room-by-member",
      now: new Date(now.getTime() + 5_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    const resumed = await app.resumeLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room",
      now: new Date(now.getTime() + 6_000),
    });
    const pukaSale = resumed.projection.sales.find(sale => sale.playerName === "Puka Nacua");
    if (pukaSale === undefined) throw new Error("Expected Puka sale fixture.");
    const corrected = await app.correctLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: resumed.revision,
      idempotencyKey: "correct-puka-sale",
      saleEventId: pukaSale.saleEventId,
      replacementSale: "owner04 puka 41",
      now: new Date(now.getTime() + 7_000),
    });
    expect(corrected.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Owner04", playerName: "Puka Nacua", price: 41 }),
    ]);
    const restored = await app.undoLastLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: corrected.revision,
      idempotencyKey: "undo-puka-correction",
      now: new Date(now.getTime() + 8_000),
    });
    expect(restored.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Owner11", playerName: "Puka Nacua", price: 62 }),
    ]);

    const exportResult = await app.exportLiveDraftRoom({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 9_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 10_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: restored.revision,
      idempotencyKey: "end-room-before-export",
      allowIncomplete: true,
      now: new Date(now.getTime() + 11_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner04.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 12_000),
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      exportedAt: new Date(now.getTime() + 13_000),
    })).rejects.toThrow(new PlatformAppError(
      "draft_room_not_final",
      "Final export requires every team to fill every roster slot.",
    ));
    const reopened = await app.reopenLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: ended.revision,
      idempotencyKey: "reopen-room-after-emergency-end",
      now: new Date(now.getTime() + 14_000),
    });

    expect(exportResult.sheetName).toBe("Draft Results");
    expect(exportResult.table[0]?.slice(0, 2)).toEqual(["League", "League 100001"]);

    const teamHeaderRow = exportResult.table[5];
    if (teamHeaderRow === undefined) throw new Error("Expected team header row.");
    const camColumn = teamHeaderRow.indexOf("Owner11");
    expect(camColumn).toBeGreaterThanOrEqual(0);

    const rb1Row = exportResult.table.find(row => row[0] === "RB1");
    const wr1Row = exportResult.table.find(row => row[0] === "WR1");
    expect(rb1Row?.slice(camColumn, camColumn + 3)).toEqual(["RB1", "De'Von Achane", 50]);
    expect(wr1Row?.slice(camColumn, camColumn + 3)).toEqual(["WR1", "Puka Nacua", 62]);
    expect(exportResult.csv).toContain("Puka Nacua,62");
    expect(reopened).toMatchObject({ status: "paused", revision: ended.revision + 1 });
    expect(reopened.endedAt).toBeUndefined();
  });

  it("rejects snake hosted rooms before delegating creation to the repository", async () => {
    const liveDraftRoomRepository = new AsyncLiveDraftRoomRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "owner11-snake-room@example.com", "owner11 password", now);
    const season = asSnakeSeason(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Snake League",
      setupStatus: "published",
    }));
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    await expect(app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_snake",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    })).rejects.toThrow(new LiveDraftRoomError(
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    ));
    expect(liveDraftRoomRepository.createInputs).toEqual([]);
    expect(liveDraftRoomRepository.inner.rooms()).toEqual([]);
  });

  it("cancels a setup room idempotently so league setup can resume and the room can be recreated", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11-cancel@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04-cancel@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const created = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_cancel_setup",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    const cancellation = {
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: created.revision,
      idempotencyKey: "cancel:room_cancel_setup",
      now: new Date(now.getTime() + 1_000),
    } as const;

    await expect(app.cancelLiveDraftRoom({
      ...cancellation,
      actorSessionToken: owner04.sessionToken,
    })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
    await expect(app.cancelLiveDraftRoom(cancellation)).resolves.toBeUndefined();
    await expect(app.cancelLiveDraftRoom(cancellation)).resolves.toBeUndefined();
    await expect(app.hasLiveDraftRoomForSeason(season.id)).resolves.toBe(false);
    await expect(app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: created.roomId,
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ roomId: created.roomId, seasonId: season.id });
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
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const created = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_async_repo",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: created.revision,
      idempotencyKey: "start-async-repo-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await app.logLiveDraftSale({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: 2,
      idempotencyKey: "async-repo-sale-puka",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const ended = await app.endLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      expectedRevision: sold.revision,
      idempotencyKey: "end-async-repo-room",
      allowIncomplete: true,
      now: new Date(now.getTime() + 3_000),
    });
    await expect(app.createLiveDraftRoomExportArtifact({
      actorSessionToken: owner11.sessionToken,
      roomId: created.roomId,
      exportedAt: new Date(now.getTime() + 4_000),
    })).rejects.toThrow(new PlatformAppError(
      "draft_room_not_final",
      "Final export requires every team to fill every roster slot.",
    ));

    expect(ended.revision).toBe(4);
    expect(exportArtifactRepository.savedByUserIds).toEqual([]);
    expect(exportArtifactRepository.savedResults).toEqual([]);
    expect(app.store.liveDraftRooms.rooms()).toEqual([]);
    expect(app.store.exportArtifacts.artifacts()).toEqual([]);
  });
});
