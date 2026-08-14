import { MockDraftSessionError } from "./error.js";
import type {
  GetMockDraftSessionInput,
  ListMockDraftSessionsForOwnerInput,
} from "./inputs.js";
import { pruneExpiredMockDraftSessions } from "./retention.js";
import type { MockDraftSession } from "./session.js";
import type { MockDraftSessionRepositoryState } from "./state.js";

export const findAuthorizedMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  userId: string,
  sessionId: string,
): MockDraftSession => {
  const session = state.sessionsById.get(sessionId);
  if (session === undefined) {
    throw new MockDraftSessionError("session_not_found", "Mock draft session was not found.");
  }
  if (session.userId !== userId) {
    throw new MockDraftSessionError("access_denied", "Mock draft session belongs to another user.");
  }
  return session;
};

export const getMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  input: GetMockDraftSessionInput,
): MockDraftSession => {
  pruneExpiredMockDraftSessions(state, input.now ?? new Date());
  return findAuthorizedMockDraftSession(state, input.userId, input.sessionId);
};

export const listMockDraftSessionsForOwner = (
  state: MockDraftSessionRepositoryState,
  input: ListMockDraftSessionsForOwnerInput,
): readonly MockDraftSession[] => {
  pruneExpiredMockDraftSessions(state, input.now ?? new Date());
  return [...state.sessionsById.values()]
    .filter(session =>
      session.userId === input.userId
      && session.leagueId === input.leagueId
      && session.seasonId === input.seasonId
      && session.ownerId === input.ownerId
      && (input.teamId === undefined || session.teamId === input.teamId)
    )
    .sort((left, right) => {
      const createdAtOrder = left.createdAt.getTime() - right.createdAt.getTime();
      return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
    });
};
