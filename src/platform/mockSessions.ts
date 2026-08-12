import { randomBytes } from "node:crypto";
import {
  normalizeSeasonMockConfigurationSnapshot,
  SeasonMockConfigurationSnapshotError,
  type SeasonMockConfigurationSnapshotState,
  type SeasonMockConfigurationSnapshotV2,
} from "./seasonMockSnapshot.js";

export type MockDraftSessionStatus = "setup" | "active" | "completed" | "abandoned";
export type MockDraftFormat = "auction" | "snake";

export type MockDraftSessionErrorCode =
  | "access_denied"
  | "command_idempotency_conflict"
  | "command_key_required"
  | "command_required"
  | "mock_count_required"
  | "owner_required"
  | "session_not_found"
  | "session_not_reusable"
  | "session_not_writable"
  | "stale_command_count"
  | "stale_revision"
  | "team_required";

export class MockDraftSessionError extends Error {
  readonly code: MockDraftSessionErrorCode;

  constructor(code: MockDraftSessionErrorCode, message: string) {
    super(message);
    this.name = "MockDraftSessionError";
    this.code = code;
  }
}

export type MockDraftMetadataValue =
  | null
  | boolean
  | number
  | string
  | readonly MockDraftMetadataValue[]
  | { readonly [key: string]: MockDraftMetadataValue };

export interface MockDraftModeMetadata {
  format: MockDraftFormat;
  mockCount: number;
  label?: string;
  settings?: { readonly [key: string]: MockDraftMetadataValue };
}

export interface MockDraftResultReference {
  id: string;
  kind: "mock-result" | "simulation-result";
  label?: string;
}

export interface MockDraftCommand {
  id: string;
  idempotencyKey: string;
  command: string;
  revision: number;
  createdAt: Date;
}

export interface MockDraftSession {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  status: MockDraftSessionStatus;
  draftMode: MockDraftModeMetadata;
  configurationSnapshot: SeasonMockConfigurationSnapshotState;
  revision: number;
  commandLog: readonly MockDraftCommand[];
  latestResultRef: MockDraftResultReference | undefined;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  abandonedAt: Date | undefined;
}

export interface CreateMockDraftSessionInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  draftMode: MockDraftModeMetadata;
  configurationSnapshot?: SeasonMockConfigurationSnapshotV2 | undefined;
  status?: Extract<MockDraftSessionStatus, "setup" | "active"> | undefined;
  now?: Date | undefined;
}

export interface GetMockDraftSessionInput {
  userId: string;
  sessionId: string;
}

export interface ListMockDraftSessionsForOwnerInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId?: string | undefined;
}

export interface AppendMockDraftCommandInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  expectedCommandCount: number;
  commandId: string;
  command: string;
  idempotencyKey?: string | undefined;
  latestResultRef?: MockDraftResultReference | undefined;
  now?: Date | undefined;
}

export interface FindStoredMockDraftCommandForRetryInput {
  userId: string;
  sessionId: string;
  commandId: string;
  command: string;
  idempotencyKey?: string | undefined;
}

export interface StoredMockDraftCommandRetry {
  session: MockDraftSession;
  command: MockDraftCommand;
}

export interface MarkMockDraftSessionCompletedInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  latestResultRef?: MockDraftResultReference | undefined;
  now?: Date | undefined;
}

export interface ResetMockDraftSessionInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

export interface AbandonMockDraftSessionInput {
  userId: string;
  sessionId: string;
  expectedRevision: number;
  now?: Date | undefined;
}

const sessionIdBytes = 16;

const createSessionId = (): string => `mock_sess_${randomBytes(sessionIdBytes).toString("base64url")}`;

const requireNonEmpty = (
  value: string,
  code: Extract<
    MockDraftSessionErrorCode,
    "command_key_required" | "command_required" | "owner_required" | "team_required"
  >,
  message: string,
): string => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new MockDraftSessionError(code, message);
  }

  return trimmedValue;
};

const validateDraftMode = (draftMode: MockDraftModeMetadata): MockDraftModeMetadata => {
  if (!Number.isInteger(draftMode.mockCount) || draftMode.mockCount <= 0) {
    throw new MockDraftSessionError("mock_count_required", "Mock count must be a positive whole number.");
  }

  return {
    ...draftMode,
    ...(draftMode.label === undefined ? {} : { label: draftMode.label.trim() }),
    ...(draftMode.settings === undefined ? {} : { settings: { ...draftMode.settings } }),
  };
};

const normalizedSessionConfigurationSnapshot = (
  session: Pick<MockDraftSession, "leagueId" | "seasonId" | "teamId" | "draftMode">,
  value: unknown,
): SeasonMockConfigurationSnapshotState => {
  const snapshot = normalizeSeasonMockConfigurationSnapshot(value);
  if (snapshot.status === "migration-required") return snapshot;
  const { payload } = snapshot;
  if (
    payload.season.leagueId !== session.leagueId
    || payload.season.id !== session.seasonId
    || payload.humanTeamId !== session.teamId
    || payload.season.settings.draftFormat !== session.draftMode.format
  ) {
    throw new SeasonMockConfigurationSnapshotError(
      "snapshot_malformed",
      "Mock draft configuration snapshot is malformed.",
    );
  }
  return snapshot;
};

export const normalizePersistedMockDraftSession = (session: MockDraftSession): MockDraftSession => ({
  ...session,
  configurationSnapshot: normalizedSessionConfigurationSnapshot(session, session.configurationSnapshot),
});

const assertWritableForCommand = (session: MockDraftSession): void => {
  if (session.status === "completed" || session.status === "abandoned") {
    throw new MockDraftSessionError(
      "session_not_writable",
      "Completed or abandoned mock draft sessions cannot accept new commands.",
    );
  }
};

const assertExpectedRevision = (session: MockDraftSession, expectedRevision: number): void => {
  if (expectedRevision !== session.revision) {
    throw new MockDraftSessionError(
      "stale_revision",
      "Mock draft session changed since this action was prepared. Refresh and try again.",
    );
  }
};

const assertExpectedCommandCount = (session: MockDraftSession, expectedCommandCount: number): void => {
  if (expectedCommandCount !== session.commandLog.length) {
    throw new MockDraftSessionError(
      "stale_command_count",
      `Mock draft session expected ${expectedCommandCount} command(s), but it has ${session.commandLog.length}. Refresh and try again.`,
    );
  }
};

export class InMemoryMockDraftSessionRepository {
  readonly #sessionsById = new Map<string, MockDraftSession>();

  constructor(sessions: readonly MockDraftSession[] = []) {
    this.replaceSessions(sessions);
  }

  createSession(input: CreateMockDraftSessionInput): MockDraftSession {
    const now = input.now ?? new Date();
    const status = input.status ?? "active";
    const session: MockDraftSession = {
      id: createSessionId(),
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: requireNonEmpty(input.ownerId, "owner_required", "Owner id is required."),
      teamId: requireNonEmpty(input.teamId, "team_required", "Team id is required."),
      status,
      draftMode: validateDraftMode(input.draftMode),
      configurationSnapshot: normalizedSessionConfigurationSnapshot(
        {
          leagueId: input.leagueId,
          seasonId: input.seasonId,
          teamId: input.teamId,
          draftMode: input.draftMode,
        },
        input.configurationSnapshot,
      ),
      revision: 1,
      commandLog: [],
      latestResultRef: undefined,
      createdAt: now,
      updatedAt: now,
      startedAt: status === "active" ? now : undefined,
      completedAt: undefined,
      abandonedAt: undefined,
    };

    this.#sessionsById.set(session.id, session);

    return session;
  }

  getSession(input: GetMockDraftSessionInput): MockDraftSession {
    return this.#findAuthorizedSession(input.userId, input.sessionId);
  }

  listSessionsForOwner(input: ListMockDraftSessionsForOwnerInput): readonly MockDraftSession[] {
    return [...this.#sessionsById.values()]
      .filter(session =>
        session.userId === input.userId
        && session.leagueId === input.leagueId
        && session.seasonId === input.seasonId
        && session.ownerId === input.ownerId
        && (input.teamId === undefined || session.teamId === input.teamId),
      )
      .sort((leftSession, rightSession) => {
        const createdAtOrder = leftSession.createdAt.getTime() - rightSession.createdAt.getTime();

        return createdAtOrder === 0 ? leftSession.id.localeCompare(rightSession.id) : createdAtOrder;
      });
  }

  appendCommand(input: AppendMockDraftCommandInput): MockDraftSession {
    const now = input.now ?? new Date();
    const commandId = requireNonEmpty(input.commandId, "command_key_required", "Command id is required.");
    const command = requireNonEmpty(input.command, "command_required", "Command cannot be empty.");
    const idempotencyKey = input.idempotencyKey?.trim() || commandId;
    const storedRetry = this.findStoredCommandForRetry({
      userId: input.userId,
      sessionId: input.sessionId,
      commandId,
      command,
      idempotencyKey,
    });
    if (storedRetry !== undefined) return storedRetry.session;
    const session = this.#findAuthorizedSession(input.userId, input.sessionId);

    assertWritableForCommand(session);

    assertExpectedRevision(session, input.expectedRevision);
    assertExpectedCommandCount(session, input.expectedCommandCount);

    const updatedSession: MockDraftSession = {
      ...session,
      status: session.status === "setup" ? "active" : session.status,
      commandLog: [
        ...session.commandLog,
        {
          id: commandId,
          idempotencyKey,
          command,
          revision: session.revision,
          createdAt: now,
        },
      ],
      ...(input.latestResultRef === undefined ? {} : { latestResultRef: input.latestResultRef }),
      startedAt: session.startedAt ?? now,
      updatedAt: now,
    };

    this.#sessionsById.set(updatedSession.id, updatedSession);

    return updatedSession;
  }

  findStoredCommandForRetry(
    input: FindStoredMockDraftCommandForRetryInput,
  ): StoredMockDraftCommandRetry | undefined {
    const commandId = requireNonEmpty(input.commandId, "command_key_required", "Command id is required.");
    const command = requireNonEmpty(input.command, "command_required", "Command cannot be empty.");
    const idempotencyKey = input.idempotencyKey?.trim() || commandId;
    const session = this.#findAuthorizedSession(input.userId, input.sessionId);
    const storedCommand = session.commandLog.find(candidate =>
      candidate.revision === session.revision && candidate.idempotencyKey === idempotencyKey
    );
    if (storedCommand === undefined) return undefined;
    if (storedCommand.id !== commandId || storedCommand.command !== command) {
      throw new MockDraftSessionError(
        "command_idempotency_conflict",
        "A command already exists for this idempotency key with different input.",
      );
    }
    return { session, command: storedCommand };
  }

  markCompleted(input: MarkMockDraftSessionCompletedInput): MockDraftSession {
    const now = input.now ?? new Date();
    const session = this.#findAuthorizedSession(input.userId, input.sessionId);

    assertExpectedRevision(session, input.expectedRevision);

    if (session.status === "abandoned") {
      throw new MockDraftSessionError("session_not_writable", "Abandoned mock draft sessions cannot be completed.");
    }

    const updatedSession: MockDraftSession = {
      ...session,
      status: "completed",
      ...(input.latestResultRef === undefined ? {} : { latestResultRef: input.latestResultRef }),
      startedAt: session.startedAt ?? now,
      completedAt: now,
      updatedAt: now,
    };

    this.#sessionsById.set(updatedSession.id, updatedSession);

    return updatedSession;
  }

  resetSession(input: ResetMockDraftSessionInput): MockDraftSession {
    const now = input.now ?? new Date();
    const session = this.#findAuthorizedSession(input.userId, input.sessionId);

    assertExpectedRevision(session, input.expectedRevision);

    if (session.status === "abandoned") {
      throw new MockDraftSessionError("session_not_reusable", "Abandoned mock draft sessions cannot be reset.");
    }

    const updatedSession: MockDraftSession = {
      ...session,
      status: "active",
      revision: session.revision + 1,
      commandLog: [],
      latestResultRef: undefined,
      startedAt: now,
      completedAt: undefined,
      abandonedAt: undefined,
      updatedAt: now,
    };

    this.#sessionsById.set(updatedSession.id, updatedSession);

    return updatedSession;
  }

  abandonSession(input: AbandonMockDraftSessionInput): MockDraftSession {
    const now = input.now ?? new Date();
    const session = this.#findAuthorizedSession(input.userId, input.sessionId);

    assertExpectedRevision(session, input.expectedRevision);

    if (session.status === "completed") {
      throw new MockDraftSessionError("session_not_writable", "Completed mock draft sessions cannot be abandoned.");
    }

    const updatedSession: MockDraftSession = {
      ...session,
      status: "abandoned",
      abandonedAt: now,
      updatedAt: now,
    };

    this.#sessionsById.set(updatedSession.id, updatedSession);

    return updatedSession;
  }

  sessions(): readonly MockDraftSession[] {
    return [...this.#sessionsById.values()].map(session => structuredClone(session));
  }

  replaceSessions(sessions: readonly MockDraftSession[]): void {
    this.#sessionsById.clear();

    for (const session of sessions) {
      const normalizedSession = normalizePersistedMockDraftSession(structuredClone(session));
      this.#sessionsById.set(normalizedSession.id, normalizedSession);
    }
  }

  #findAuthorizedSession(userId: string, sessionId: string): MockDraftSession {
    const session = this.#sessionsById.get(sessionId);

    if (session === undefined) {
      throw new MockDraftSessionError("session_not_found", "Mock draft session was not found.");
    }

    if (session.userId !== userId) {
      throw new MockDraftSessionError("access_denied", "Mock draft session belongs to another user.");
    }

    return session;
  }
}
