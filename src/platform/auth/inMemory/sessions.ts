import type {
  CreateCredentialSessionRecordInput,
  CreateSessionRecordInput,
  SessionRecord,
} from "../records.js";
import type { InMemoryAuthState } from "./state.js";

export const createSession = (state: InMemoryAuthState, input: CreateSessionRecordInput): SessionRecord => {
  const session: SessionRecord = {
    id: input.id,
    accountId: input.accountId,
    tokenHash: input.tokenHash,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    revokedAt: undefined,
  };
  state.sessionsById.set(input.id, session);
  state.sessionIdsByTokenHash.set(input.tokenHash, input.id);
  state.authVersionsBySessionId.set(input.id, state.authVersionsByAccountId.get(input.accountId) ?? 1);
  return session;
};

export const createSessionForCredential = (
  state: InMemoryAuthState,
  input: CreateCredentialSessionRecordInput,
): SessionRecord | null => {
  const credential = state.accountsById.get(input.accountId);
  return credential === undefined || credential.passwordHash !== input.expectedPasswordHash
    ? null
    : createSession(state, input);
};

export const findSessionByTokenHash = (state: InMemoryAuthState, tokenHash: string): SessionRecord | null => {
  const sessionId = state.sessionIdsByTokenHash.get(tokenHash);
  if (sessionId === undefined) return null;
  const session = state.sessionsById.get(sessionId);
  if (session === undefined) return null;
  return state.authVersionsBySessionId.get(sessionId) === state.authVersionsByAccountId.get(session.accountId)
    ? session
    : null;
};

export const findSessionById = (state: InMemoryAuthState, sessionId: string): SessionRecord | null =>
  state.sessionsById.get(sessionId) ?? null;

export const revokeSession = (
  state: InMemoryAuthState,
  sessionId: string,
  revokedAt: Date,
): SessionRecord | null => {
  const session = state.sessionsById.get(sessionId);
  if (session === undefined) return null;
  const revokedSession = { ...session, revokedAt };
  state.sessionsById.set(sessionId, revokedSession);
  return revokedSession;
};
