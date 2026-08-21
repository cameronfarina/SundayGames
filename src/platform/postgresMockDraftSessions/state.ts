import {
  InMemoryMockDraftSessionRepository,
  MockDraftSessionError,
  type MockDraftSession,
  type MockDraftSessionResourcePolicy,
} from "../mockSessions.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  MockDraftSessionOwnerRow,
  MockDraftSessionRow,
} from "./contracts.js";
import { persistMockDraftSessionChanges } from "./persistence.js";
import { mockDraftSessionFromRow } from "./rowCodec.js";
import { selectUserMockDraftSessionsSql } from "./sql.js";

const loadUserSessions = async (
  client: PostgresQueryClient,
  userId: string,
): Promise<MockDraftSession[]> => {
  const result = await client.query<MockDraftSessionRow>(
    `${selectUserMockDraftSessionsSql} FOR UPDATE OF ms`,
    [userId],
  );
  return result.rows.map(mockDraftSessionFromRow);
};

const assertSessionOwnership = async (
  client: PostgresQueryClient,
  sessions: readonly MockDraftSession[],
  userId: string,
  sessionId: string | undefined,
): Promise<void> => {
  if (sessionId === undefined || sessions.some(session => session.id === sessionId)) return;
  const result = await client.query<MockDraftSessionOwnerRow>(
    "SELECT user_id FROM mock_sessions WHERE id = $1",
    [sessionId],
  );
  if (result.rows[0] === undefined) {
    throw new MockDraftSessionError("session_not_found", "Mock draft session was not found.");
  }
  if (result.rows[0].user_id !== userId) {
    throw new MockDraftSessionError("access_denied", "Mock draft session belongs to another user.");
  }
};

export const runWithMockDraftSessionState = async <T>(
  client: PostgresQueryClient,
  userId: string,
  resourcePolicy: Partial<MockDraftSessionResourcePolicy>,
  operation: (repository: InMemoryMockDraftSessionRepository) => T,
  sessionId?: string,
): Promise<{ result: T; sessions: readonly MockDraftSession[] }> => {
  await client.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [userId]);
  const before = await loadUserSessions(client, userId);
  await assertSessionOwnership(client, before, userId, sessionId);
  const repository = new InMemoryMockDraftSessionRepository(before, resourcePolicy);
  const result = operation(repository);
  const sessions = repository.sessions();
  await persistMockDraftSessionChanges(client, userId, before, sessions);
  return { result, sessions };
};
