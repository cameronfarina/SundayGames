import { describe, expect, it } from "vitest";
import {
  InMemoryMockDraftSessionRepository,
  MockDraftSessionError,
} from "../src/platform/mockSessions.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createSeasonMockConfigurationSnapshot } from "../src/platform/seasonMockSnapshot.js";
import { leagueConfig, ownerOrder } from "../config/league.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const leagueId = "league_home";
const seasonId = "season_2026";
const draftMode = {
  format: "auction",
  mockCount: 5,
  label: "Practice auction",
} as const;

const createCamSession = (
  repository: InMemoryMockDraftSessionRepository,
  createdAt = now,
) =>
  repository.createSession({
    userId: "user_cam",
    leagueId,
    seasonId,
    ownerId: "owner_cam",
    teamId: "team_cam",
    draftMode,
    now: createdAt,
  });

describe("platform mock draft sessions", () => {
  it("stores immutable configuration snapshots and marks unsnapshotted sessions for migration", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const teamId = season.teams[0]?.id ?? "missing-team";
    const configurationSnapshot = createSeasonMockConfigurationSnapshot({
      season,
      setup: {
        seasonId: season.id,
        sourceVersion: "rankings-2026.1",
        playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
        initialRosters: [],
        contentHash: "setup-hash",
        updatedAt: now,
      },
      humanTeamId: teamId,
      playerExpectedPrices: { "puka-nacua": 69 },
      capturedAt: now,
    });
    const snapped = repository.createSession({
      userId: "user_cam",
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: "owner_cam",
      teamId,
      draftMode,
      configurationSnapshot,
      now,
    });
    const legacy = createCamSession(repository);

    expect(snapped.configurationSnapshot).toEqual(configurationSnapshot);
    expect(Object.isFrozen(snapped.configurationSnapshot)).toBe(true);
    expect(legacy.configurationSnapshot).toEqual({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "missing-snapshot",
    });
    expect(() => repository.createSession({
      userId: "user_cam",
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: "owner_cam",
      teamId: season.teams[1]?.id ?? "other-team",
      draftMode,
      configurationSnapshot,
      now,
    })).toThrow("Mock draft configuration snapshot is malformed.");
  });

  it("creates active private sessions and lists only the creating user's owner sessions", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const camSession = createCamSession(repository);
    repository.createSession({
      userId: "user_rival",
      leagueId,
      seasonId,
      ownerId: "owner_cam",
      teamId: "team_cam",
      draftMode,
      now: new Date(now.getTime() + 1_000),
    });

    expect(camSession).toEqual({
      id: expect.stringMatching(/^mock_sess_/),
      userId: "user_cam",
      leagueId,
      seasonId,
      ownerId: "owner_cam",
      teamId: "team_cam",
      status: "active",
      draftMode,
      configurationSnapshot: {
        status: "migration-required",
        schema: "mockd-season-mock",
        reason: "missing-snapshot",
      },
      revision: 1,
      commandLog: [],
      latestResultRef: undefined,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: undefined,
      abandonedAt: undefined,
    });
    expect(repository.getSession({ userId: "user_cam", sessionId: camSession.id })).toBe(camSession);
    expect(repository.listSessionsForOwner({
      userId: "user_cam",
      leagueId,
      seasonId,
      ownerId: "owner_cam",
    })).toEqual([camSession]);
    expect(repository.listSessionsForOwner({
      userId: "user_rival",
      leagueId,
      seasonId,
      ownerId: "owner_cam",
    })).not.toContain(camSession);
    expect(() =>
      repository.getSession({ userId: "user_rival", sessionId: camSession.id }),
    ).toThrow(new MockDraftSessionError("access_denied", "Mock draft session belongs to another user."));
  });

  it("validates owner, team, mock count, command text, command id, and missing sessions", () => {
    const repository = new InMemoryMockDraftSessionRepository();

    expect(() =>
      repository.createSession({
        userId: "user_cam",
        leagueId,
        seasonId,
        ownerId: " ",
        teamId: "team_cam",
        draftMode,
        now,
      }),
    ).toThrow(new MockDraftSessionError("owner_required", "Owner id is required."));
    expect(() =>
      repository.createSession({
        userId: "user_cam",
        leagueId,
        seasonId,
        ownerId: "owner_cam",
        teamId: "",
        draftMode,
        now,
      }),
    ).toThrow(new MockDraftSessionError("team_required", "Team id is required."));
    expect(() =>
      repository.createSession({
        userId: "user_cam",
        leagueId,
        seasonId,
        ownerId: "owner_cam",
        teamId: "team_cam",
        draftMode: { format: "auction", mockCount: 0 },
        now,
      }),
    ).toThrow(new MockDraftSessionError("mock_count_required", "Mock count must be a positive whole number."));
    expect(() =>
      repository.getSession({ userId: "user_cam", sessionId: "missing-session" }),
    ).toThrow(new MockDraftSessionError("session_not_found", "Mock draft session was not found."));

    const session = createCamSession(repository);

    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: " ",
        command: "draft puka for 62",
        now,
      }),
    ).toThrow(new MockDraftSessionError("command_key_required", "Command id is required."));
    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_1",
        command: " ",
        now,
      }),
    ).toThrow(new MockDraftSessionError("command_required", "Command cannot be empty."));
  });

  it("appends commands idempotently by command idempotency key", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);
    const appendedAt = new Date(now.getTime() + 1_000);

    const firstAppend = repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
      now: appendedAt,
    });
    const duplicateAppend = repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
      now: new Date(now.getTime() + 2_000),
    });

    expect(firstAppend.commandLog).toEqual([
      {
        id: "cmd_puka",
        idempotencyKey: "sale:puka:62",
        command: "draft Puka Nacua for $62",
        revision: 1,
        createdAt: appendedAt,
      },
    ]);
    expect(duplicateAppend).toBe(firstAppend);
    expect(duplicateAppend.commandLog).toHaveLength(1);
    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_other",
        idempotencyKey: "sale:puka:62",
        command: "draft Puka Nacua for $61",
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new MockDraftSessionError(
      "command_idempotency_conflict",
      "A command already exists for this idempotency key with different input.",
    ));

    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_late_tab",
        idempotencyKey: "sale:ladd:21",
        command: "draft Ladd McConkey for $21",
        now: new Date(now.getTime() + 4_000),
      }),
    ).toThrow(new MockDraftSessionError(
      "stale_command_count",
      "Mock draft session expected 0 command(s), but it has 1. Refresh and try again.",
    ));
  });

  it("finds stored command retries before replay while preserving privacy and conflict checks", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);
    const appended = repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
      now,
    });

    expect(repository.findStoredCommandForRetry({
      userId: "user_cam",
      sessionId: session.id,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
    })).toEqual({
      session: appended,
      command: appended.commandLog[0],
    });
    const completed = repository.markCompleted({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: session.revision,
      now: new Date(now.getTime() + 1_000),
    });
    expect(repository.findStoredCommandForRetry({
      userId: "user_cam",
      sessionId: session.id,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
    })?.session).toBe(completed);
    expect(repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 0,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
      now: new Date(now.getTime() + 2_000),
    })).toBe(completed);
    expect(repository.findStoredCommandForRetry({
      userId: "user_cam",
      sessionId: session.id,
      commandId: "cmd_ladd",
      idempotencyKey: "sale:ladd:21",
      command: "draft Ladd McConkey for $21",
    })).toBeUndefined();
    expect(() => repository.findStoredCommandForRetry({
      userId: "user_cam",
      sessionId: session.id,
      commandId: "cmd_changed",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $61",
    })).toThrow(new MockDraftSessionError(
      "command_idempotency_conflict",
      "A command already exists for this idempotency key with different input.",
    ));
    expect(() => repository.findStoredCommandForRetry({
      userId: "user_rival",
      sessionId: session.id,
      commandId: "cmd_puka",
      idempotencyKey: "sale:puka:62",
      command: "draft Puka Nacua for $62",
    })).toThrow(new MockDraftSessionError("access_denied", "Mock draft session belongs to another user."));
  });

  it("rejects command writes after completion while keeping the result reference", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);
    repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_start",
      command: "draft Puka Nacua for $62",
      now: new Date(now.getTime() + 1_000),
    });

    const completedAt = new Date(now.getTime() + 2_000);
    const completedSession = repository.markCompleted({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      latestResultRef: {
        id: "result_completed_mock",
        kind: "mock-result",
        label: "Completed practice auction",
      },
      now: completedAt,
    });

    expect(completedSession).toMatchObject({
      status: "completed",
      latestResultRef: {
        id: "result_completed_mock",
        kind: "mock-result",
        label: "Completed practice auction",
      },
      completedAt,
      updatedAt: completedAt,
    });
    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_after_done",
        command: "draft Drake Maye for $20",
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new MockDraftSessionError(
      "session_not_writable",
      "Completed or abandoned mock draft sessions cannot accept new commands.",
    ));
  });

  it("resets completed sessions to a clean active revision without old commands or results", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);
    repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_original",
      command: "draft Puka Nacua for $62",
      now: new Date(now.getTime() + 1_000),
    });
    repository.markCompleted({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      latestResultRef: { id: "old_result", kind: "mock-result" },
      now: new Date(now.getTime() + 2_000),
    });

    const resetAt = new Date(now.getTime() + 3_000);
    const resetSession = repository.resetSession({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      now: resetAt,
    });

    expect(resetSession).toEqual({
      id: session.id,
      userId: "user_cam",
      leagueId,
      seasonId,
      ownerId: "owner_cam",
      teamId: "team_cam",
      status: "active",
      draftMode,
      configurationSnapshot: {
        status: "migration-required",
        schema: "mockd-season-mock",
        reason: "missing-snapshot",
      },
      revision: 2,
      commandLog: [],
      latestResultRef: undefined,
      createdAt: now,
      updatedAt: resetAt,
      startedAt: resetAt,
      completedAt: undefined,
      abandonedAt: undefined,
    });

    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_original",
        command: "draft Puka Nacua for $62",
        now: new Date(now.getTime() + 4_000),
      }),
    ).toThrow(new MockDraftSessionError(
      "stale_revision",
      "Mock draft session changed since this action was prepared. Refresh and try again.",
    ));

    const appendedAfterReset = repository.appendCommand({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 2,
      expectedCommandCount: 0,
      commandId: "cmd_after_reset",
      command: "draft Puka Nacua for $62",
      now: new Date(now.getTime() + 4_000),
    });

    expect(appendedAfterReset.commandLog).toEqual([
      {
        id: "cmd_after_reset",
        idempotencyKey: "cmd_after_reset",
        command: "draft Puka Nacua for $62",
        revision: 2,
        createdAt: new Date(now.getTime() + 4_000),
      },
    ]);
  });

  it("does not let abandoned sessions accept commands or reset back into use", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);
    const abandonedAt = new Date(now.getTime() + 1_000);
    const abandonedSession = repository.abandonSession({
      userId: "user_cam",
      sessionId: session.id,
      expectedRevision: 1,
      now: abandonedAt,
    });

    expect(abandonedSession.status).toBe("abandoned");
    expect(abandonedSession.abandonedAt).toBe(abandonedAt);
    expect(() =>
      repository.appendCommand({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_after_abandon",
        command: "draft Ladd McConkey for $21",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new MockDraftSessionError(
      "session_not_writable",
      "Completed or abandoned mock draft sessions cannot accept new commands.",
    ));
    expect(() =>
      repository.resetSession({
        userId: "user_cam",
        sessionId: session.id,
        expectedRevision: 1,
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new MockDraftSessionError("session_not_reusable", "Abandoned mock draft sessions cannot be reset."));
  });

  it("denies mutations from users who do not own the private mock session", () => {
    const repository = new InMemoryMockDraftSessionRepository();
    const session = createCamSession(repository);

    expect(() =>
      repository.appendCommand({
        userId: "user_rival",
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_rival",
        command: "draft Puka Nacua for $1",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new MockDraftSessionError("access_denied", "Mock draft session belongs to another user."));
    expect(() =>
      repository.resetSession({
        userId: "user_rival",
        sessionId: session.id,
        expectedRevision: 1,
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new MockDraftSessionError("access_denied", "Mock draft session belongs to another user."));
    expect(() =>
      repository.abandonSession({
        userId: "user_rival",
        sessionId: session.id,
        expectedRevision: 1,
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new MockDraftSessionError("access_denied", "Mock draft session belongs to another user."));
  });
});
