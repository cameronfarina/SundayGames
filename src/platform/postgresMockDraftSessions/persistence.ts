import { randomBytes } from "node:crypto";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { MockDraftCommand, MockDraftSession } from "../mockSessions.js";
import { jsonbParameter } from "./json.js";
import {
  insertMockDraftCommandSql,
  upsertMockDraftSessionSql,
} from "./sql.js";

const eventIdBytes = 16;
const createEventId = (): string => `mock_evt_${randomBytes(eventIdBytes).toString("base64url")}`;

const sessionFingerprint = (session: MockDraftSession): string => JSON.stringify(session);

const saveSession = async (
  client: PostgresQueryClient,
  session: MockDraftSession,
): Promise<void> => {
  await client.query(upsertMockDraftSessionSql, [
    session.id,
    session.leagueId,
    session.seasonId,
    session.userId,
    session.ownerId,
    session.teamId,
    session.status,
    session.revision,
    session.commandLog.length,
    jsonbParameter(session.draftMode),
    jsonbParameter(session.configurationSnapshot),
    session.latestResultRef === undefined ? null : jsonbParameter(session.latestResultRef),
    session.startedAt ?? null,
    session.completedAt ?? null,
    session.abandonedAt ?? null,
    session.createdAt,
    session.updatedAt,
  ]);
};

const commandKey = (command: MockDraftCommand): string =>
  `${String(command.revision)}\u0000${command.idempotencyKey}`;

const saveNewCommands = async (
  client: PostgresQueryClient,
  before: MockDraftSession | undefined,
  after: MockDraftSession,
): Promise<void> => {
  const existingKeys = new Set(before?.commandLog.map(commandKey) ?? []);
  for (const command of after.commandLog) {
    if (existingKeys.has(commandKey(command))) continue;
    await client.query(insertMockDraftCommandSql, [
      createEventId(),
      after.id,
      command.revision,
      command.id,
      command.command,
      command.idempotencyKey,
      command.createdAt,
    ]);
  }
};

export const persistMockDraftSessionChanges = async (
  client: PostgresQueryClient,
  userId: string,
  before: readonly MockDraftSession[],
  after: readonly MockDraftSession[],
): Promise<void> => {
  const beforeById = new Map(before.map(session => [session.id, session]));
  const afterById = new Map(after.map(session => [session.id, session]));
  const removedIds = before
    .filter(session => !afterById.has(session.id))
    .map(session => session.id);
  if (removedIds.length > 0) {
    await client.query(
      "DELETE FROM mock_sessions WHERE user_id = $1 AND id = ANY($2::text[])",
      [userId, removedIds],
    );
  }
  for (const session of after) {
    const previous = beforeById.get(session.id);
    if (previous !== undefined && sessionFingerprint(previous) === sessionFingerprint(session)) continue;
    await saveSession(client, session);
    await saveNewCommands(client, previous, session);
  }
};
