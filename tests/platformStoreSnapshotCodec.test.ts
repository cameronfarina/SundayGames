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

describe("platform store snapshot codec", () => {
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
    const season = {
      ...buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig),
      setupStatus: "published" as const,
    };
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
          reversal: "third-round",
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
          version: 1,
          payload: {},
        },
      }],
    })).toThrow("Mock draft configuration snapshot is malformed.");
  });
});
