import { MockDraftSessionError } from "./error.js";
import type {
  AssertActiveMockDraftSessionCapacityInput,
  AssertMockDraftSessionCreationAllowedInput,
} from "./inputs.js";
import { pruneExpiredMockDraftSessions } from "./retention.js";
import type { MockDraftSessionRepositoryState } from "./state.js";

export const assertActiveMockDraftSessionCapacity = (
  state: MockDraftSessionRepositoryState,
  input: AssertActiveMockDraftSessionCapacityInput,
): void => {
  const activeSessions = [...state.sessionsById.values()].filter(session =>
    session.userId === input.userId
    && session.id !== input.excludeSessionId
    && (session.status === "setup" || session.status === "active")
  );
  const activeSeasonSessions = activeSessions.filter(session => session.seasonId === input.seasonId);
  if (activeSeasonSessions.length >= state.resourcePolicy.maxActiveSessionsPerUserSeason) {
    throw new MockDraftSessionError(
      "season_active_session_limit",
      "Finish or abandon an active mock draft for this season before starting another.",
    );
  }
  if (activeSessions.length >= state.resourcePolicy.maxActiveSessionsPerUser) {
    throw new MockDraftSessionError(
      "user_active_session_limit",
      "Finish or abandon an active mock draft before starting another.",
    );
  }
};

export const assertMockDraftSessionCreationAllowed = (
  state: MockDraftSessionRepositoryState,
  input: AssertMockDraftSessionCreationAllowedInput,
): void => {
  const now = input.now ?? new Date();
  pruneExpiredMockDraftSessions(state, now);
  const windowStartedAt = now.getTime() - state.resourcePolicy.creationWindowMs;
  const recentCreations = [...state.sessionsById.values()]
    .filter(session =>
      session.userId === input.userId
      && session.createdAt.getTime() > windowStartedAt
      && session.createdAt <= now
    )
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  if (recentCreations.length >= state.resourcePolicy.maxCreationsPerWindow) {
    const earliestCreation = recentCreations[0];
    const retryAfterMs = earliestCreation === undefined
      ? state.resourcePolicy.creationWindowMs
      : earliestCreation.createdAt.getTime() + state.resourcePolicy.creationWindowMs - now.getTime();
    throw new MockDraftSessionError(
      "session_creation_rate_limited",
      "Too many mock drafts were started recently. Try again later.",
      Math.max(1, Math.ceil(retryAfterMs / 1_000)),
    );
  }
  assertActiveMockDraftSessionCapacity(state, input);
};
