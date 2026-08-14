import { describe, expect, it } from "vitest";
import {
  InMemoryMockDraftSessionRepository,
  MockDraftSessionError,
} from "../src/platform/mockSessions.js";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
} from "../src/platform/platformStoreSnapshotCodec.js";

const createdAt = new Date("2026-08-14T12:00:00.000Z");
const commandAt = new Date("2026-08-14T12:01:00.000Z");
const completedAt = new Date("2026-08-14T12:02:00.000Z");

describe("mock session lifecycle characterization", () => {
  it("keeps private target reporting across save, reopen, finish, and restore", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const created = repository.createSession({
      userId: "user_cam",
      leagueId: "league_sunday_games",
      seasonId: "season_2026",
      ownerId: "owner_cam",
      teamId: "team_cam",
      draftMode: { format: "auction", mockCount: 25 },
      status: "setup",
      now: createdAt,
    });
    const saved = repository.appendCommand({
      userId: "user_cam",
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "command_target_report",
      command: "open saved simulation result",
      latestResultRef: {
        id: "simulation_run_25",
        kind: "simulation-result",
        label: "Jahmyr Gibbs target hit rate: 84%",
      },
      now: commandAt,
    });

    expect(repository.getSession({
      userId: "user_cam",
      sessionId: created.id,
      now: commandAt,
    })).toBe(saved);
    expect(() => repository.getSession({
      userId: "user_rival",
      sessionId: created.id,
      now: commandAt,
    })).toThrow(new MockDraftSessionError(
      "access_denied",
      "Mock draft session belongs to another user.",
    ));
    expect(repository.listSessionsForOwner({
      userId: "user_rival",
      leagueId: created.leagueId,
      seasonId: created.seasonId,
      ownerId: created.ownerId,
      now: commandAt,
    })).toEqual([]);

    const finished = repository.markCompleted({
      userId: "user_cam",
      sessionId: created.id,
      expectedRevision: created.revision,
      now: completedAt,
    });
    const serialized = serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: repository.sessions(),
    });
    const restoredSnapshot = deserializePlatformStoreSnapshot(serialized);
    const restored = new InMemoryMockDraftSessionRepository(restoredSnapshot.mockDraftSessions);

    expect(finished).toMatchObject({
      status: "completed",
      commandLog: saved.commandLog,
      latestResultRef: saved.latestResultRef,
      completedAt,
    });
    expect(restored.getSession({
      userId: "user_cam",
      sessionId: created.id,
      now: completedAt,
    })).toEqual(finished);
    expect(() => restored.resetSession({
      userId: "user_rival",
      sessionId: created.id,
      expectedRevision: created.revision,
      now: completedAt,
    })).toThrow(new MockDraftSessionError(
      "access_denied",
      "Mock draft session belongs to another user.",
    ));
  });
});
