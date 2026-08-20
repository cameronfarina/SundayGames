import { describe, expect, it } from "vitest";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { PostgresMockDraftSessionRepository } from "../src/platform/postgresMockDraftSessions.js";
import {
  InMemoryMockDraftSessionRepository,
  type MockDraftSessionStatus,
} from "../src/platform/mockSessions.js";
import { persistedMockDraftSessions } from "./platformStoreSnapshotFixtures/mockSessions.js";

interface StoredMockSessionRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  owner_id: string;
  team_id: string;
  status: MockDraftSessionStatus;
  revision: number;
  command_count: number;
  draft_mode_json: unknown;
  configuration_snapshot_json: unknown;
  latest_result_ref_json: unknown;
  started_at: Date | null;
  completed_at: Date | null;
  abandoned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface StoredMockEventRow {
  id: string;
  mock_session_id: string;
  revision: number;
  sequence: number;
  command_id: string;
  command: string;
  idempotency_key: string;
  created_at: Date;
}

const normalizeSql = (text: string): string => text.replace(/\s+/gu, " ").trim();
const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value) as unknown
  : cloneJson(value);

class FakeMockSessionPostgresClient implements PostgresTransactionalQueryClient {
  readonly sessions = new Map<string, StoredMockSessionRow>();
  readonly events: StoredMockEventRow[] = [];
  readonly queries: string[] = [];
  rejectNextEventInsert = false;
  #transactionTail: Promise<void> = Promise.resolve();

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    let release = (): void => undefined;
    const previous = this.#transactionTail;
    this.#transactionTail = new Promise(resolve => {
      release = resolve;
    });
    await previous;
    const sessionsBefore = structuredClone([...this.sessions]);
    const eventsBefore = structuredClone(this.events);
    try {
      return await operation(this);
    } catch (error) {
      this.sessions.clear();
      for (const [id, session] of sessionsBefore) this.sessions.set(id, session);
      this.events.splice(0, this.events.length, ...eventsBefore);
      throw error;
    } finally {
      release();
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const sql = normalizeSql(text);
    this.queries.push(sql);
    if (sql.startsWith("SELECT id FROM accounts") && sql.endsWith("FOR UPDATE")) {
      return { rows: [] };
    }
    if (sql.startsWith("SELECT ms.*")) {
      const userId = values[0];
      const rows = [...this.sessions.values()]
        .filter(row => row.user_id === userId)
        .map(row => ({
          ...row,
          command_log_json: this.events
            .filter(event => event.mock_session_id === row.id && event.revision === row.revision)
            .sort((left, right) => left.sequence - right.sequence)
            .map(event => ({
              id: event.command_id,
              idempotencyKey: event.idempotency_key,
              command: event.command,
              revision: event.revision,
              createdAt: event.created_at,
            })),
        }));
      return { rows: rows as TRow[] };
    }
    if (sql === "SELECT user_id FROM mock_sessions WHERE id = $1") {
      const session = this.sessions.get(String(values[0]));
      return { rows: session === undefined ? [] : [{ user_id: session.user_id } as TRow] };
    }
    if (sql.startsWith("INSERT INTO mock_sessions")) {
      const [
        id, leagueId, seasonId, userId, ownerId, teamId, status, revision,
        commandCount, draftMode, configurationSnapshot, latestResultRef,
        startedAt, completedAt, abandonedAt, createdAt, updatedAt,
      ] = values;
      if (
        typeof id !== "string" || typeof leagueId !== "string" ||
        typeof seasonId !== "string" || typeof userId !== "string" ||
        typeof ownerId !== "string" || typeof teamId !== "string" ||
        (status !== "setup" && status !== "active" && status !== "completed" && status !== "abandoned") ||
        typeof revision !== "number" || typeof commandCount !== "number" ||
        !(createdAt instanceof Date) || !(updatedAt instanceof Date)
      ) throw new Error("Invalid mock session insert values.");
      const existing = this.sessions.get(id);
      this.sessions.set(id, {
        id,
        league_id: leagueId,
        league_season_id: seasonId,
        user_id: userId,
        owner_id: ownerId,
        team_id: teamId,
        status,
        revision,
        command_count: commandCount,
        draft_mode_json: existing?.draft_mode_json ?? jsonValue(draftMode),
        configuration_snapshot_json: existing?.configuration_snapshot_json ??
          jsonValue(configurationSnapshot),
        latest_result_ref_json: latestResultRef === null ? null : jsonValue(latestResultRef),
        started_at: startedAt instanceof Date ? startedAt : null,
        completed_at: completedAt instanceof Date ? completedAt : null,
        abandoned_at: abandonedAt instanceof Date ? abandonedAt : null,
        created_at: existing?.created_at ?? createdAt,
        updated_at: updatedAt,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM mock_sessions")) {
      const [userId, removedIds] = values;
      if (typeof userId !== "string" || !Array.isArray(removedIds)) {
        throw new Error("Invalid mock session delete values.");
      }
      for (const id of removedIds) {
        if (typeof id === "string" && this.sessions.get(id)?.user_id === userId) {
          this.sessions.delete(id);
        }
      }
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO mock_session_events")) {
      if (this.rejectNextEventInsert) {
        this.rejectNextEventInsert = false;
        throw new Error("injected event failure");
      }
      const [id, sessionId, revision, commandId, command, idempotencyKey, createdAt] = values;
      if (
        typeof id !== "string" || typeof sessionId !== "string" ||
        typeof revision !== "number" || typeof commandId !== "string" ||
        typeof command !== "string" || typeof idempotencyKey !== "string" ||
        !(createdAt instanceof Date)
      ) throw new Error("Invalid mock event insert values.");
      if (!this.events.some(event => event.mock_session_id === sessionId &&
          event.revision === revision && event.idempotency_key === idempotencyKey)) {
        const sequence = this.events
          .filter(event => event.mock_session_id === sessionId)
          .reduce((maximum, event) => Math.max(maximum, event.sequence), 0) + 1;
        this.events.push({
          id,
          mock_session_id: sessionId,
          revision,
          sequence,
          command_id: commandId,
          command,
          idempotency_key: idempotencyKey,
          created_at: createdAt,
        });
      }
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

const sessionInput = () => {
  const template = persistedMockDraftSessions()[0];
  if (template === undefined || template.configurationSnapshot.status !== "ready") {
    throw new Error("Expected a replayable mock session fixture.");
  }
  return {
    userId: template.userId,
    leagueId: template.leagueId,
    seasonId: template.seasonId,
    ownerId: template.ownerId,
    teamId: template.teamId,
    draftMode: template.draftMode,
    configurationSnapshot: template.configurationSnapshot,
    now: new Date("2026-08-20T12:00:00.000Z"),
  } as const;
};

describe("Postgres mock draft sessions", () => {
  it("reloads immutable replay configuration and idempotent commands", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client);
    const input = sessionInput();
    const created = await repository.createSession(input);
    const appended = await repository.appendCommand({
      userId: input.userId,
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "command-1",
      idempotencyKey: "draft:puka:62",
      command: "draft puka for 62",
      now: new Date("2026-08-20T12:01:00.000Z"),
    });

    const reloaded = new PostgresMockDraftSessionRepository(client);
    await expect(reloaded.getSession({
      userId: input.userId,
      sessionId: created.id,
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).resolves.toMatchObject({
      id: created.id,
      configurationSnapshot: input.configurationSnapshot,
      draftMode: input.draftMode,
      commandLog: [{
        id: "command-1",
        idempotencyKey: "draft:puka:62",
        command: "draft puka for 62",
      }],
    });
    await expect(reloaded.findStoredCommandForRetry({
      userId: input.userId,
      sessionId: created.id,
      commandId: "command-1",
      idempotencyKey: "draft:puka:62",
      command: "draft puka for 62",
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).resolves.toMatchObject({ session: appended, command: { id: "command-1" } });
    await expect(reloaded.findStoredCommandForRetry({
      userId: input.userId,
      sessionId: created.id,
      commandId: "command-2",
      idempotencyKey: "draft:puka:62",
      command: "draft puka for 70",
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).rejects.toMatchObject({ code: "command_idempotency_conflict" });
    await expect(reloaded.getSession({
      userId: "another-user",
      sessionId: created.id,
    })).rejects.toMatchObject({ code: "access_denied" });
  });

  it("commits a final command and completion once under an idempotent duplicate race", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client);
    const input = sessionInput();
    const created = await repository.createSession(input);
    const finalInput = {
      userId: input.userId,
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "complete-1",
      idempotencyKey: "complete-1",
      command: JSON.stringify({ type: "complete", expectedRevision: 0 }),
      completeSession: true,
      now: new Date("2026-08-20T12:01:00.000Z"),
    } as const;

    const results = await Promise.all([
      repository.appendCommand(finalInput),
      repository.appendCommand(finalInput),
    ]);

    expect(results).toEqual([
      expect.objectContaining({
        status: "completed",
        completedAt: finalInput.now,
        commandLog: [expect.objectContaining({ id: "complete-1" })],
      }),
      expect.objectContaining({
        status: "completed",
        completedAt: finalInput.now,
        commandLog: [expect.objectContaining({ id: "complete-1" })],
      }),
    ]);

    expect(client.events).toHaveLength(1);
  });

  it("repairs a pre-cutover final command whose completion was interrupted", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client);
    const input = sessionInput();
    const created = await repository.createSession(input);
    const finalInput = {
      userId: input.userId,
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "legacy-final",
      idempotencyKey: "legacy-final",
      command: "complete",
      now: new Date("2026-08-20T12:01:00.000Z"),
    } as const;

    await expect(repository.appendCommand(finalInput)).resolves.toMatchObject({ status: "active" });
    await expect(repository.appendCommand({
      ...finalInput,
      completeSession: true,
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).resolves.toMatchObject({
      status: "completed",
      completedAt: new Date("2026-08-20T12:02:00.000Z"),
    });
    expect(client.events).toHaveLength(1);
  });

  it("rolls back both the final command and completion when event persistence fails", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client);
    const input = sessionInput();
    const created = await repository.createSession(input);
    client.rejectNextEventInsert = true;

    await expect(repository.appendCommand({
      userId: input.userId,
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "complete-failure",
      command: "complete",
      completeSession: true,
      now: new Date("2026-08-20T12:01:00.000Z"),
    })).rejects.toThrow("injected event failure");

    await expect(repository.getSession({
      userId: input.userId,
      sessionId: created.id,
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).resolves.toMatchObject({ status: "active", commandLog: [] });
  });

  it("mirrors committed user state for compatibility dual writes", async () => {
    const client = new FakeMockSessionPostgresClient();
    const compatibility = new InMemoryMockDraftSessionRepository();
    const repository = new PostgresMockDraftSessionRepository(
      client,
      {},
      (userId, sessions) => compatibility.replaceSessionsForUser(userId, sessions),
    );
    const input = sessionInput();

    const created = await repository.createSession(input);
    await repository.appendCommand({
      userId: input.userId,
      sessionId: created.id,
      expectedRevision: created.revision,
      expectedCommandCount: 0,
      commandId: "start-1",
      command: "start",
      now: new Date("2026-08-20T12:01:00.000Z"),
    });

    expect(compatibility.getSession({
      userId: input.userId,
      sessionId: created.id,
      now: new Date("2026-08-20T12:02:00.000Z"),
    })).toMatchObject({ commandLog: [{ id: "start-1" }] });
  });

  it("serializes concurrent creates before applying active-session quotas", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client, {
      maxActiveSessionsPerUser: 1,
      maxActiveSessionsPerUserSeason: 1,
    });
    const input = sessionInput();

    const outcomes = await Promise.allSettled([
      repository.createSession(input),
      repository.createSession({ ...input, now: new Date(input.now.getTime() + 1) }),
    ]);

    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: "season_active_session_limit" }) }),
    ]);
    expect(client.sessions.size).toBe(1);
    expect(client.queries.filter(query =>
      query === "SELECT id FROM accounts WHERE id = $1 FOR UPDATE"
    )).toHaveLength(2);
  });

  it("rejects command-count drift instead of replaying partial state", async () => {
    const client = new FakeMockSessionPostgresClient();
    const repository = new PostgresMockDraftSessionRepository(client);
    const input = sessionInput();
    const created = await repository.createSession(input);
    const row = client.sessions.get(created.id);
    if (row === undefined) throw new Error("Expected a stored mock session.");
    row.command_count = 1;

    await expect(repository.getSession({
      userId: input.userId,
      sessionId: created.id,
    })).rejects.toThrow(`Mock draft session ${created.id} has an inconsistent command count.`);
  });
});
