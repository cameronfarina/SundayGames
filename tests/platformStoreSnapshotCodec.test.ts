import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AnyLeagueSeason,
} from "../src/platform/leagueSeason.js";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
} from "../src/platform/platformStoreSnapshotCodec.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";
import { InMemoryMockDraftSessionRepository } from "../src/platform/mockSessions.js";
import { createSeasonMockConfigurationSnapshot } from "../src/platform/seasonMockSnapshot.js";
import { persistedSimulationRun } from "./platformStoreSnapshotFixtures/simulationRun.js";

describe("platform store snapshot codec", () => {
  it("round trips archived league metadata for file-backed local storage", () => {
    const archivedAt = new Date("2026-08-12T18:00:00.000Z");
    const decoded = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      leagueCreationRecords: [{
        leagueId: "league_archived",
        createdByUserId: "account_cam",
        createdAt: new Date("2025-08-12T18:00:00.000Z"),
        archivedAt,
        archivedByUserId: "account_cam",
      }],
    }));

    expect(decoded.leagueCreationRecords).toEqual([{
      leagueId: "league_archived",
      createdByUserId: "account_cam",
      createdAt: new Date("2025-08-12T18:00:00.000Z"),
      archivedAt,
      archivedByUserId: "account_cam",
    }]);
  });

  it("round trips saved keeper setups for file-backed server restarts", async () => {
    const store = new InMemoryPlatformStore();
    await store.liveDraftRoomSetups.save({
      seasonId: "season_2026",
      sourceVersion: "catalog-2026",
      playerCatalog: [{ name: "De'Von Achane", position: "RB", expectedPrice: 50 }],
      initialRosters: [{
        teamId: "team_cam",
        playerName: "De'Von Achane",
        position: "RB",
        price: 48,
        source: "keeper",
      }],
      updatedAt: new Date("2026-08-11T20:00:00.000Z"),
    });

    const restored = new InMemoryPlatformStore(deserializePlatformStoreSnapshot(
      serializePlatformStoreSnapshot(store.snapshot()),
    ));

    await expect(restored.liveDraftRoomSetups.findForSeason("season_2026")).resolves.toMatchObject({
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
      updatedAt: new Date("2026-08-11T20:00:00.000Z"),
    });
  });

  it("recovers legacy keeper setup data from an existing live room", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    season.setupStatus = "published";
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a seeded team.");
    const store = new InMemoryPlatformStore();
    store.liveDraftRooms.createRoom({
      roomId: "room_legacy_2026",
      season,
      commissionerUserId: "user_cam",
      viewerPasswordHashRef: "membership",
      playerCatalog: [{ name: "De'Von Achane", position: "RB", expectedPrice: 50 }],
      initialRosters: [{
        teamId: team.id,
        playerName: "De'Von Achane",
        position: "RB",
        price: 48,
        source: "keeper",
      }],
      createdAt: new Date("2026-08-11T20:00:00.000Z"),
    });

    const legacySnapshot = store.snapshot();
    const restored = new InMemoryPlatformStore({
      ...legacySnapshot,
      liveDraftRoomSetups: [],
    });

    await expect(restored.liveDraftRoomSetups.findForSeason(season.id)).resolves.toMatchObject({
      sourceVersion: "recovered-live-room:room_legacy_2026",
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
    });
  });

  it("decodes legacy seeded auction seasons with explicit format and scoring defaults", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const { draftFormat: _draftFormat, scoring: _scoring, ...legacySettings } = season.settings;

    const decoded = deserializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      leagueSeasons: [{ ...season, settings: legacySettings }],
    });

    expect(decoded.leagueSeasons).toEqual([season]);
  });

  it("round trips snake format, scoring, and snake-only settings", () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: {
          ...auctionSeason.settings.scoring,
          passingTouchdown: 6,
          reception: 1,
        },
        snake: {
          rounds: 18,
          order: auctionSeason.teams.map(team => team.id),
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };
    const snapshot = {
      ...emptyPlatformStoreSnapshot(),
      leagueSeasons: [snakeSeason],
    };

    const decoded = deserializePlatformStoreSnapshot(
      serializePlatformStoreSnapshot(snapshot),
    );

    expect(decoded.leagueSeasons).toEqual([snakeSeason]);
    expect(decoded.leagueSeasons[0]?.settings).not.toHaveProperty("auction");
  });

  it("decodes a snapshot whose snake settings still carry the retired reversal key", () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: auctionSeason.settings.scoring,
        snake: {
          rounds: 4,
          order: auctionSeason.teams.map(team => team.id),
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };
    const legacySnapshotJson = {
      ...emptyPlatformStoreSnapshot(),
      leagueSeasons: [{
        ...snakeSeason,
        settings: {
          ...snakeSeason.settings,
          snake: { ...snakeSeason.settings.snake, reversal: "third-round" },
        },
      }],
    };

    const decoded = deserializePlatformStoreSnapshot(legacySnapshotJson);

    expect(decoded.leagueSeasons).toEqual([snakeSeason]);
  });

  it("round trips immutable mock configuration snapshots and upgrades legacy sessions explicitly", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const teamId = season.teams[0]?.id ?? "missing-team";
    const repository = new InMemoryMockDraftSessionRepository();
    const session = repository.createSession({
      userId: "user_cam",
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: "owner_cam",
      teamId,
      draftMode: { format: "auction", mockCount: 1 },
      configurationSnapshot: createSeasonMockConfigurationSnapshot({
        season,
        setup: {
          seasonId: season.id,
          sourceVersion: "rankings-2026.1",
          playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
          initialRosters: [],
          contentHash: "setup-hash",
          updatedAt: new Date("2026-08-11T14:00:00.000Z"),
        },
        humanTeamId: teamId,
        playerExpectedPrices: { "puka-nacua": 69 },
        capturedAt: new Date("2026-08-11T15:00:00.000Z"),
      }),
      now: new Date("2026-08-11T15:00:00.000Z"),
    });
    const decoded = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: [session],
    }));

    expect(decoded.mockDraftSessions[0]?.configurationSnapshot).toEqual(session.configurationSnapshot);

    const { configurationSnapshot: _configurationSnapshot, ...legacySession } = session;
    const decodedLegacy = deserializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: [legacySession],
    });

    expect(decodedLegacy.mockDraftSessions[0]?.configurationSnapshot).toEqual({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "missing-snapshot",
    });
  });

  it("rejects malformed persisted mock configuration snapshots", () => {
    expect(() => deserializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: [{
        configurationSnapshot: {
          status: "ready",
          schema: "mockd-season-mock",
          version: 2,
          payload: {},
        },
      }],
    })).toThrow("Mock draft configuration snapshot is malformed.");
  });

  it("defaults collections omitted by legacy snapshots", () => {
    expect(deserializePlatformStoreSnapshot({ schemaVersion: 1 })).toEqual(
      emptyPlatformStoreSnapshot(),
    );
  });

  it("defaults legacy null collections and auth state", () => {
    expect(deserializePlatformStoreSnapshot({
      schemaVersion: 1,
      auth: null,
      memberships: null,
    })).toEqual(emptyPlatformStoreSnapshot());
  });

  it("rejects a malformed top-level collection", () => {
    expect(() => deserializePlatformStoreSnapshot({ memberships: "not-an-array" }))
      .toThrow("Invalid platform store snapshot at memberships");
  });

  it("rejects malformed nested auth records", () => {
    expect(() => deserializePlatformStoreSnapshot({
      auth: {
        accountCredentials: [],
        sessions: [{
          id: "session-1",
          accountId: "account-1",
          createdAt: "2026-08-09T12:00:00.000Z",
          expiresAt: "2026-08-09T13:00:00.000Z",
        }],
      },
    })).toThrow("Invalid platform store snapshot at auth.sessions[0].tokenHash");
  });

  it("revives persisted dates without changing date-like job input values", () => {
    const decoded = deserializePlatformStoreSnapshot({
      auth: {
        accountCredentials: [],
        sessions: [{
          id: "session-1",
          accountId: "account-1",
          tokenHash: "hash-1",
          createdAt: "2026-08-09T12:00:00.000Z",
          expiresAt: "2026-08-09T13:00:00.000Z",
          revokedAt: null,
        }],
      },
      jobs: [{
        id: "job-1",
        userId: "account-1",
        leagueId: "league-1",
        seasonId: "season-1",
        kind: "simulation",
        status: "queued",
        inputJson: { updatedAt: "2026-08-09T12:00:00.000Z" },
        inputHash: "input-hash",
        idempotencyKey: "job-key",
        progress: { completed: 0, total: 1, message: "Queued" },
        attempts: 0,
        maxAttempts: 3,
        workerId: null,
        lockedAt: null,
        heartbeatAt: null,
        lockExpiresAt: null,
        startedAt: null,
        finishedAt: null,
        cancellationRequestedAt: null,
        resultSummary: null,
        sanitizedError: null,
        createdAt: "2026-08-09T12:00:00.000Z",
        updatedAt: "2026-08-09T12:00:00.000Z",
      }],
    });

    expect(decoded.auth.sessions[0]?.createdAt).toEqual(
      new Date("2026-08-09T12:00:00.000Z"),
    );
    expect(decoded.jobs[0]?.createdAt).toEqual(
      new Date("2026-08-09T12:00:00.000Z"),
    );
    expect(decoded.jobs[0]?.inputJson).toEqual({
      updatedAt: "2026-08-09T12:00:00.000Z",
    });
    expect(decoded.jobs[0]?.resultSummary).toBeNull();
  });

  it("round trips complete simulation results without trusting nested JSON", () => {
    const simulationRun = persistedSimulationRun();
    const decoded = deserializePlatformStoreSnapshot({ simulationRuns: [simulationRun] });

    expect(decoded.simulationRuns).toEqual([simulationRun]);
  });
});
