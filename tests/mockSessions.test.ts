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

const now = new Date("2026-08-13T12:00:00.000Z");

const createSession = (
  repository: InMemoryMockDraftSessionRepository,
  seasonId: string,
  createdAt = now,
) => repository.createSession({
  userId: "account_cam",
  leagueId: "league_sunday_games",
  seasonId,
  ownerId: "owner_cam",
  teamId: "team_cam",
  draftMode: { format: "auction", mockCount: 1 },
  status: "setup",
  now: createdAt,
});

describe("interactive mock session resource policy", () => {
  it("bounds active sessions per user and per season while completed sessions free capacity", () => {
    const repository = new InMemoryMockDraftSessionRepository([], {
      maxActiveSessionsPerUser: 2,
      maxActiveSessionsPerUserSeason: 2,
      maxCreationsPerWindow: 100,
    });
    const first = createSession(repository, "season_2026");
    const second = createSession(repository, "season_2026");
    const persisted = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: repository.sessions(),
    }));
    const restored = new InMemoryMockDraftSessionRepository(persisted.mockDraftSessions, {
      maxActiveSessionsPerUser: 2,
      maxActiveSessionsPerUserSeason: 2,
      maxCreationsPerWindow: 100,
    });

    expect(() => createSession(restored, "season_2026")).toThrow(
      new MockDraftSessionError(
        "season_active_session_limit",
        "Finish or abandon an active mock draft for this season before starting another.",
      ),
    );

    restored.markCompleted({
      userId: "account_cam",
      sessionId: first.id,
      expectedRevision: first.revision,
      now: new Date(now.getTime() + 1_000),
    });
    createSession(restored, "season_2026", new Date(now.getTime() + 2_000));

    expect(() => createSession(restored, "season_2027", new Date(now.getTime() + 3_000))).toThrow(
      new MockDraftSessionError(
        "user_active_session_limit",
        "Finish or abandon an active mock draft before starting another.",
      ),
    );

    expect(restored.getSession({ userId: "account_cam", sessionId: second.id, now }).status)
      .toBe("setup");
  });

  it("rejects reset when reactivation would exceed the season active-session limit", () => {
    const repository = new InMemoryMockDraftSessionRepository([], {
      maxActiveSessionsPerUser: 2,
      maxActiveSessionsPerUserSeason: 1,
      maxCreationsPerWindow: 100,
    });
    const completed = createSession(repository, "season_2026", now);
    repository.markCompleted({
      userId: "account_cam",
      sessionId: completed.id,
      expectedRevision: completed.revision,
      now: new Date(now.getTime() + 1_000),
    });
    createSession(repository, "season_2026", new Date(now.getTime() + 2_000));

    expect(() => repository.resetSession({
      userId: "account_cam",
      sessionId: completed.id,
      expectedRevision: completed.revision,
      now: new Date(now.getTime() + 3_000),
    })).toThrow(new MockDraftSessionError(
      "season_active_session_limit",
      "Finish or abandon an active mock draft for this season before starting another.",
    ));
    expect(repository.getSession({
      userId: "account_cam",
      sessionId: completed.id,
      now: new Date(now.getTime() + 3_000),
    })).toMatchObject({
      status: "completed",
      revision: completed.revision,
      completedAt: new Date(now.getTime() + 1_000),
    });
  });

  it("rejects reset when reactivation would exceed the user's active-session limit", () => {
    const repository = new InMemoryMockDraftSessionRepository([], {
      maxActiveSessionsPerUser: 2,
      maxActiveSessionsPerUserSeason: 2,
      maxCreationsPerWindow: 100,
    });
    const completed = createSession(repository, "season_2026", now);
    repository.markCompleted({
      userId: "account_cam",
      sessionId: completed.id,
      expectedRevision: completed.revision,
      now: new Date(now.getTime() + 1_000),
    });
    createSession(repository, "season_2026", new Date(now.getTime() + 2_000));
    createSession(repository, "season_2027", new Date(now.getTime() + 3_000));

    expect(() => repository.resetSession({
      userId: "account_cam",
      sessionId: completed.id,
      expectedRevision: completed.revision,
      now: new Date(now.getTime() + 4_000),
    })).toThrow(new MockDraftSessionError(
      "user_active_session_limit",
      "Finish or abandon an active mock draft before starting another.",
    ));
  });

  it("excludes an already-active reset target from active-session quotas", () => {
    const repository = new InMemoryMockDraftSessionRepository([], {
      maxActiveSessionsPerUser: 1,
      maxActiveSessionsPerUserSeason: 1,
      maxCreationsPerWindow: 100,
    });
    const setup = createSession(repository, "season_2026", now);
    const active = repository.appendCommand({
      userId: "account_cam",
      sessionId: setup.id,
      expectedRevision: setup.revision,
      expectedCommandCount: 0,
      commandId: "command_1",
      command: "draft Puka Nacua for 62",
      now: new Date(now.getTime() + 1_000),
    });

    expect(repository.resetSession({
      userId: "account_cam",
      sessionId: active.id,
      expectedRevision: active.revision,
      now: new Date(now.getTime() + 2_000),
    })).toMatchObject({
      id: active.id,
      status: "active",
      revision: active.revision + 1,
      commandLog: [],
      startedAt: new Date(now.getTime() + 2_000),
    });
  });

  it("persists creation rate limits and reports when another session can be created", () => {
    const policy = {
      maxActiveSessionsPerUser: 100,
      maxActiveSessionsPerUserSeason: 100,
      maxCreationsPerWindow: 2,
      creationWindowMs: 60_000,
    };
    const repository = new InMemoryMockDraftSessionRepository([], policy);
    createSession(repository, "season_2026", now);
    createSession(repository, "season_2026", new Date(now.getTime() + 1_000));

    expect(() => createSession(repository, "season_2026", new Date(now.getTime() + 2_000)))
      .toThrow(new MockDraftSessionError(
        "session_creation_rate_limited",
        "Too many mock drafts were started recently. Try again later.",
        58,
      ));

    const persisted = deserializePlatformStoreSnapshot(serializePlatformStoreSnapshot({
      ...emptyPlatformStoreSnapshot(),
      mockDraftSessions: repository.sessions(),
    }));
    const restored = new InMemoryMockDraftSessionRepository(persisted.mockDraftSessions, policy);
    expect(() => createSession(restored, "season_2027", new Date(now.getTime() + 3_000)))
      .toThrow(expect.objectContaining({
        code: "session_creation_rate_limited",
        retryAfterSeconds: 57,
      }));

    expect(createSession(restored, "season_2027", new Date(now.getTime() + 60_000)).seasonId)
      .toBe("season_2027");
  });

  it("abandons inactive sessions and deletes abandoned and completed sessions after retention", () => {
    const policy = {
      maxActiveSessionsPerUser: 100,
      maxActiveSessionsPerUserSeason: 100,
      maxCreationsPerWindow: 100,
      inactiveSessionTtlMs: 60_000,
      abandonedRetentionMs: 120_000,
      completedRetentionMs: 180_000,
    };
    const repository = new InMemoryMockDraftSessionRepository([], policy);
    const inactive = createSession(repository, "season_2026", now);
    const explicitlyAbandoned = createSession(
      repository,
      "season_2026",
      new Date(now.getTime() + 1_000),
    );
    repository.abandonSession({
      userId: "account_cam",
      sessionId: explicitlyAbandoned.id,
      expectedRevision: explicitlyAbandoned.revision,
      now: new Date(now.getTime() + 2_000),
    });
    const completed = createSession(repository, "season_2026", new Date(now.getTime() + 3_000));
    repository.markCompleted({
      userId: "account_cam",
      sessionId: completed.id,
      expectedRevision: completed.revision,
      now: new Date(now.getTime() + 4_000),
    });

    const afterInactivity = repository.sessions(new Date(now.getTime() + 60_000));
    expect(afterInactivity.find(session => session.id === inactive.id)).toMatchObject({
      status: "abandoned",
      abandonedAt: new Date(now.getTime() + 60_000),
    });

    const restored = new InMemoryMockDraftSessionRepository(afterInactivity, policy);
    const afterAbandonedRetention = restored.sessions(new Date(now.getTime() + 182_000));
    expect(afterAbandonedRetention.map(session => session.id)).toEqual([completed.id]);

    expect(restored.sessions(new Date(now.getTime() + 184_000))).toEqual([]);
    expect(() => restored.getSession({
      userId: "account_cam",
      sessionId: completed.id,
      now: new Date(now.getTime() + 184_000),
    })).toThrow(new MockDraftSessionError("session_not_found", "Mock draft session was not found."));
  });
});
