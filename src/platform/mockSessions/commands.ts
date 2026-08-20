import { findAuthorizedMockDraftSession } from "./access.js";
import { MockDraftSessionError } from "./error.js";
import type {
  AppendMockDraftCommandInput,
  FindStoredMockDraftCommandForRetryInput,
  StoredMockDraftCommandRetry,
} from "./inputs.js";
import { pruneExpiredMockDraftSessions } from "./retention.js";
import type { MockDraftSession } from "./session.js";
import type { MockDraftSessionRepositoryState } from "./state.js";
import {
  assertCommandLogCapacity,
  assertExpectedCommandCount,
  assertExpectedRevision,
  assertWritableForCommand,
  requireNonEmpty,
} from "./validation.js";

const completeAfterCommand = (
  session: MockDraftSession,
  completeSession: boolean | undefined,
  now: Date,
): MockDraftSession => completeSession === true && session.status !== "completed"
  ? { ...session, status: "completed", completedAt: now, updatedAt: now }
  : session;

export const findStoredMockDraftCommandForRetry = (
  state: MockDraftSessionRepositoryState,
  input: FindStoredMockDraftCommandForRetryInput,
): StoredMockDraftCommandRetry | undefined => {
  pruneExpiredMockDraftSessions(state, input.now ?? new Date());
  const commandId = requireNonEmpty(input.commandId, "command_key_required", "Command id is required.");
  const command = requireNonEmpty(input.command, "command_required", "Command cannot be empty.");
  const idempotencyKey = input.idempotencyKey?.trim() || commandId;
  const session = findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
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
};

export const appendMockDraftCommand = (
  state: MockDraftSessionRepositoryState,
  input: AppendMockDraftCommandInput,
  findStoredRetry: (
    input: FindStoredMockDraftCommandForRetryInput,
  ) => StoredMockDraftCommandRetry | undefined,
): MockDraftSession => {
  const now = input.now ?? new Date();
  pruneExpiredMockDraftSessions(state, now);
  const commandId = requireNonEmpty(input.commandId, "command_key_required", "Command id is required.");
  const command = requireNonEmpty(input.command, "command_required", "Command cannot be empty.");
  const idempotencyKey = input.idempotencyKey?.trim() || commandId;
  const storedRetry = findStoredRetry({
    userId: input.userId,
    sessionId: input.sessionId,
    commandId,
    command,
    idempotencyKey,
    now,
  });
  if (storedRetry !== undefined) {
    const retriedSession = completeAfterCommand(storedRetry.session, input.completeSession, now);
    state.sessionsById.set(retriedSession.id, retriedSession);
    return retriedSession;
  }
  const session = findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
  assertWritableForCommand(session);
  assertExpectedRevision(session, input.expectedRevision);
  assertExpectedCommandCount(session, input.expectedCommandCount);
  assertCommandLogCapacity(session, { id: commandId, idempotencyKey, command }, state.resourcePolicy);
  const updatedSession: MockDraftSession = {
    ...session,
    status: session.status === "setup" ? "active" : session.status,
    commandLog: [
      ...session.commandLog,
      { id: commandId, idempotencyKey, command, revision: session.revision, createdAt: now },
    ],
    ...(input.latestResultRef === undefined ? {} : { latestResultRef: input.latestResultRef }),
    startedAt: session.startedAt ?? now,
    updatedAt: now,
  };
  const finalSession = completeAfterCommand(updatedSession, input.completeSession, now);
  state.sessionsById.set(finalSession.id, finalSession);
  return finalSession;
};
