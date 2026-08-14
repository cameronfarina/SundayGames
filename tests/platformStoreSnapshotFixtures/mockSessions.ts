import { leagueConfig, ownerOrder } from "../../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AnyLeagueSeason,
} from "../../src/platform/leagueSeason.js";
import {
  InMemoryMockDraftSessionRepository,
  type MockDraftSession,
} from "../../src/platform/mockSessions.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { createSeasonMockConfigurationSnapshot } from "../../src/platform/seasonMockSnapshot.js";

const createdAt = new Date("2026-08-09T12:00:00.000Z");

export const persistedMockDraftSessions = (): readonly MockDraftSession[] => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
  const team = season.teams[0];
  if (team === undefined) throw new Error("Expected a seeded team.");
  const repository = new InMemoryMockDraftSessionRepository();
  const roomSetup: LiveDraftRoomSetup = {
    seasonId: season.id,
    sourceVersion: "rankings-2026.1",
    playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
    initialRosters: [],
    contentHash: "setup-hash",
    updatedAt: createdAt,
  };
  const configurationSnapshot = createSeasonMockConfigurationSnapshot({
    season,
    setup: roomSetup,
    humanTeamId: team.id,
    playerExpectedPrices: { "puka-nacua": 69 },
    capturedAt: createdAt,
  });
  const created = repository.createSession({
    userId: "user-cam",
    leagueId: season.leagueId,
    seasonId: season.id,
    ownerId: team.ownerId,
    teamId: team.id,
    draftMode: {
      format: "auction",
      mockCount: 4,
      label: "Persistence mock",
      settings: {
        budget: 200,
        flags: [true, null, "fast"],
        behavior: { aggression: 0.75 },
      },
    },
    configurationSnapshot,
    now: createdAt,
  });
  repository.appendCommand({
    userId: created.userId,
    sessionId: created.id,
    expectedRevision: created.revision,
    expectedCommandCount: 0,
    commandId: "command-1",
    idempotencyKey: "mock:puka:62",
    command: "draft puka for 62",
    latestResultRef: { id: "result-1", kind: "mock-result", label: "Run 1" },
    now: new Date(createdAt.getTime() + 1_000),
  });
  const completed = repository.markCompleted({
    userId: created.userId,
    sessionId: created.id,
    expectedRevision: created.revision,
    now: new Date(createdAt.getTime() + 2_000),
  });
  const snakeSeason: AnyLeagueSeason = {
    ...season,
    settings: {
      expectedTeamCount: season.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: season.settings.scoring,
      snake: {
        rounds: 16,
        order: season.teams.map(candidate => candidate.id),
        reversal: "standard",
      },
      roster: season.settings.roster,
      keeperPolicy: season.settings.keeperPolicy,
    },
  };
  const snakeConfigurationSnapshot = createSeasonMockConfigurationSnapshot({
    season: snakeSeason,
    setup: roomSetup,
    humanTeamId: team.id,
    playerExpectedPrices: { "puka-nacua": 69 },
    capturedAt: new Date(createdAt.getTime() + 3_000),
  });
  const abandonedSetup = repository.createSession({
    userId: "user-cam",
    leagueId: season.leagueId,
    seasonId: season.id,
    ownerId: team.ownerId,
    teamId: team.id,
    draftMode: { format: "snake", mockCount: 1 },
    configurationSnapshot: snakeConfigurationSnapshot,
    status: "setup",
    now: new Date(createdAt.getTime() + 3_000),
  });
  const abandoned = repository.abandonSession({
    userId: abandonedSetup.userId,
    sessionId: abandonedSetup.id,
    expectedRevision: abandonedSetup.revision,
    now: new Date(createdAt.getTime() + 4_000),
  });
  return [completed, abandoned];
};
