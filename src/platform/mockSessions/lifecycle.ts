import { findAuthorizedMockDraftSession } from "./access.js";
import { assertActiveMockDraftSessionCapacity } from "./capacity.js";
import { MockDraftSessionError } from "./error.js";
import type {
  AbandonMockDraftSessionInput,
  MarkMockDraftSessionCompletedInput,
  ResetMockDraftSessionInput,
} from "./inputs.js";
import { pruneExpiredMockDraftSessions } from "./retention.js";
import type { MockDraftSession } from "./session.js";
import type { MockDraftSessionRepositoryState } from "./state.js";
import { assertExpectedRevision } from "./validation.js";

export const completeMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  input: MarkMockDraftSessionCompletedInput,
): MockDraftSession => {
  const now = input.now ?? new Date();
  pruneExpiredMockDraftSessions(state, now);
  const session = findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
  assertExpectedRevision(session, input.expectedRevision);
  if (session.status === "abandoned") {
    throw new MockDraftSessionError(
      "session_not_writable",
      "Abandoned mock draft sessions cannot be completed.",
    );
  }
  const updatedSession: MockDraftSession = {
    ...session,
    status: "completed",
    ...(input.latestResultRef === undefined ? {} : { latestResultRef: input.latestResultRef }),
    startedAt: session.startedAt ?? now,
    completedAt: now,
    updatedAt: now,
  };
  state.sessionsById.set(updatedSession.id, updatedSession);
  return updatedSession;
};

export const resetMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  input: ResetMockDraftSessionInput,
): MockDraftSession => {
  const now = input.now ?? new Date();
  pruneExpiredMockDraftSessions(state, now);
  const session = findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
  assertExpectedRevision(session, input.expectedRevision);
  if (session.status === "abandoned") {
    throw new MockDraftSessionError(
      "session_not_reusable",
      "Abandoned mock draft sessions cannot be reset.",
    );
  }
  assertActiveMockDraftSessionCapacity(state, {
    userId: input.userId,
    seasonId: session.seasonId,
    excludeSessionId: session.id,
  });
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
  state.sessionsById.set(updatedSession.id, updatedSession);
  return updatedSession;
};

export const abandonMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  input: AbandonMockDraftSessionInput,
): MockDraftSession => {
  const now = input.now ?? new Date();
  pruneExpiredMockDraftSessions(state, now);
  const session = findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
  assertExpectedRevision(session, input.expectedRevision);
  if (session.status === "completed" || session.status === "abandoned") {
    throw new MockDraftSessionError(
      "session_not_writable",
      "Only setup or active mock draft sessions can be abandoned.",
    );
  }
  const updatedSession: MockDraftSession = {
    ...session,
    status: "abandoned",
    abandonedAt: now,
    updatedAt: now,
  };
  state.sessionsById.set(updatedSession.id, updatedSession);
  return updatedSession;
};
