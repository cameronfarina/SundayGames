import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
} from "../src/platform/platformStoreSnapshotCodec.js";
import { persistedHistoricalImport } from "./platformStoreSnapshotFixtures/historicalImport.js";
import { persistedLiveDraftRooms } from "./platformStoreSnapshotFixtures/liveRooms.js";
import { persistedMockDraftSessions } from "./platformStoreSnapshotFixtures/mockSessions.js";

describe("platform store snapshot persisted variants", () => {
  it("round trips completed and abandoned mock sessions with recursive metadata", () => {
    const snapshot = {
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: persistedMockDraftSessions(),
    };

    expect(deserializePlatformStoreSnapshot(
      serializePlatformStoreSnapshot(snapshot),
    ).mockDraftSessions).toEqual(snapshot.mockDraftSessions);
  });

  it("round trips historical review details and supersession metadata", () => {
    const batch = persistedHistoricalImport();
    const readyRecord = batch.rows[0]?.record;
    if (readyRecord === undefined || readyRecord === null) {
      throw new Error("Expected a ready historical sale record.");
    }
    const decoded = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      historicalImportBatches: [batch],
      historicalSaleRecords: [readyRecord],
    }));

    expect(decoded.historicalImportBatches).toEqual([batch]);
    expect(decoded.historicalSaleRecords).toEqual([readyRecord]);
  });

  it("round trips every live room event and projection variant", () => {
    const rooms = persistedLiveDraftRooms();
    const decoded = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      liveDraftRooms: rooms,
    }));

    expect(decoded.liveDraftRooms).toEqual(rooms);
  });

  it("round trips rich setup catalog projections and imported roster metadata", () => {
    const setup: LiveDraftRoomSetup = {
      seasonId: "season-1",
      sourceVersion: "rankings-1",
      contentHash: "content-hash",
      updatedAt: new Date("2026-08-09T12:00:00.000Z"),
      playerCatalog: [{
        name: "Puka Nacua",
        position: "WR",
        expectedPrice: 73,
        marketPrice: 69,
        teamAbbreviation: "LAR",
        byeWeek: 8,
        week1Projection: 18,
        weeks1To4Projection: 70,
        seasonProjection: 295,
        seasonProjectionAdjustmentFactor: 1.05,
        seasonProjectionScoring: {
          rushingYards: 0.1,
          rushingTouchdown: 6,
          receivingYards: 0.1,
          receivingTouchdown: 6,
          reception: 0.5,
        },
      }],
      initialRosters: [{
        teamId: "team-1",
        playerId: "puka-nacua",
        playerName: "Puka Nacua",
        position: "WR",
        price: 50,
        keeperRound: 2,
        expectedPrice: 73,
        source: "imported",
      }],
    };

    expect(deserializePlatformStoreSnapshot({
      liveDraftRoomSetups: [setup],
    }).liveDraftRoomSetups).toEqual([setup]);
  });

  it("revives all optional auth and job dates and preserves nested JSON", () => {
    const decoded = deserializePlatformStoreSnapshot({
      auth: {
        accountCredentials: [{
          account: {
            id: "account-1",
            email: "cam@example.com",
            emailVerifiedAt: "2026-08-09T11:00:00.000Z",
            createdAt: "2026-08-09T10:00:00.000Z",
            updatedAt: "2026-08-09T12:00:00.000Z",
          },
          passwordHash: "password-hash",
        }],
        sessions: [{
          id: "session-1",
          accountId: "account-1",
          tokenHash: "token-hash",
          createdAt: "2026-08-09T12:00:00.000Z",
          expiresAt: "2026-08-10T12:00:00.000Z",
          revokedAt: "2026-08-09T13:00:00.000Z",
        }],
      },
      jobs: [{
        id: "job-1", userId: "account-1", leagueId: "league-1", seasonId: "season-1",
        kind: "export", status: "failed", inputJson: [true, null, { count: 2 }],
        inputHash: "input-hash", idempotencyKey: "job-key",
        progress: { completed: 1, total: 1, message: "Failed" }, attempts: 1, maxAttempts: 3,
        workerId: "worker-1", lockedAt: "2026-08-09T12:00:00.000Z",
        heartbeatAt: "2026-08-09T12:01:00.000Z", lockExpiresAt: "2026-08-09T12:02:00.000Z",
        startedAt: "2026-08-09T12:00:00.000Z", finishedAt: "2026-08-09T12:03:00.000Z",
        cancellationRequestedAt: "2026-08-09T12:02:30.000Z",
        resultSummary: { persisted: true }, sanitizedError: { name: "Error", message: "Failed" },
        createdAt: "2026-08-09T12:00:00.000Z", updatedAt: "2026-08-09T12:03:00.000Z",
      }],
    });

    expect(decoded.auth.accountCredentials[0]?.account.emailVerifiedAt).toBeInstanceOf(Date);
    expect(decoded.auth.sessions[0]?.revokedAt).toBeInstanceOf(Date);
    expect(decoded.jobs[0]?.finishedAt).toBeInstanceOf(Date);
    expect(decoded.jobs[0]?.resultSummary).toEqual({ persisted: true });
  });

  it("round trips draft scheduling and private shortlist state", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const scheduledSeason = {
      ...season,
      draft: {
        scheduledAt: "2026-08-20T19:00:00.000Z",
        timezone: "America/New_York",
      },
    };
    const shortlist = {
      id: "shortlist-1",
      leagueId: season.leagueId,
      seasonId: season.id,
      userId: "user-cam",
      playerName: "Puka Nacua",
      position: "WR",
      maxBid: 70,
      priority: 1,
      createdAt: new Date("2026-08-09T12:00:00.000Z"),
      updatedAt: new Date("2026-08-09T12:01:00.000Z"),
    };
    const decoded = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      leagueSeasons: [scheduledSeason],
      practiceShortlistItems: [shortlist],
    }));

    expect(decoded.leagueSeasons).toEqual([scheduledSeason]);
    expect(decoded.practiceShortlistItems).toEqual([shortlist]);
  });
});

describe("platform store snapshot validation errors", () => {
  it.each([
    { value: { schemaVersion: 2 }, path: "schemaVersion" },
    { value: { historicalImportBatches: [{ status: "unknown" }] }, path: "historicalImportBatches[0].status" },
    { value: { exportArtifacts: [{ format: "json" }] }, path: "exportArtifacts[0].format" },
    { value: { liveDraftRoomSetups: [{ seasonId: "s", sourceVersion: "v", playerCatalog: [{ name: "P", position: "P", expectedPrice: 1 }] }] }, path: "liveDraftRoomSetups[0].playerCatalog[0].position" },
    { value: { mockDraftSessions: [{ id: "m", userId: "u", leagueId: "l", seasonId: "s", ownerId: "o", teamId: "t", status: "unknown" }] }, path: "mockDraftSessions[0].status" },
    { value: { jobs: [{ id: "j", userId: "u", leagueId: "l", seasonId: "s", progress: {}, kind: "unknown" }] }, path: "jobs[0].kind" },
    { value: { jobs: [{ id: "j", userId: "u", leagueId: "l", seasonId: "s", progress: {}, kind: "import", status: "unknown" }] }, path: "jobs[0].status" },
  ])("rejects malformed data at $path", ({ value, path }) => {
    expect(() => deserializePlatformStoreSnapshot(value)).toThrow(path);
  });
});
