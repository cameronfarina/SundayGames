import { pruneExpiredMockDraftSessions } from "./retention.js";
import type { MockDraftSession } from "./session.js";
import { normalizePersistedMockDraftSession } from "./snapshot.js";
import type { MockDraftSessionRepositoryState } from "./state.js";

export const listStoredMockDraftSessions = (
  state: MockDraftSessionRepositoryState,
  now?: Date,
): readonly MockDraftSession[] => {
  if (now !== undefined) pruneExpiredMockDraftSessions(state, now);
  return [...state.sessionsById.values()].map(session => structuredClone(session));
};

export const replaceStoredMockDraftSessions = (
  state: MockDraftSessionRepositoryState,
  sessions: readonly MockDraftSession[],
): void => {
  state.sessionsById.clear();
  for (const session of sessions) {
    const normalized = normalizePersistedMockDraftSession(structuredClone(session));
    state.sessionsById.set(normalized.id, normalized);
  }
};
