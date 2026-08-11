import { describe, expect, it } from "vitest";
import {
  applyPlatformPostgresMigrations,
  findMissingPlatformPostgresMigrations,
  requiredPlatformPostgresMigrationIds,
} from "../src/platform/platformMigrations.js";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";

class RecordingPostgresClient implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  readonly appliedMigrationIds = new Set<string>();
  transactionCount = 0;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.statements.push(text);
    if (text.includes("SELECT id FROM platform_schema_migrations")) {
      const migrationId = values[0];
      return {
        rows: typeof migrationId === "string" && this.appliedMigrationIds.has(migrationId)
          ? [{ id: migrationId } as TRow]
          : [],
      };
    }

    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;

    return operation(this);
  }
}

describe("platform Postgres migrations", () => {
  it("applies the snapshot bridge schema before normalized platform tables", async () => {
    const client = new RecordingPostgresClient();

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(platformPostgresMigrationStatements.length + 2);
    expect(client.transactionCount).toBe(1);
    expect(client.statements[0]).toContain("CREATE TABLE IF NOT EXISTS platform_store_snapshots");
    expect(client.statements[1]).toContain("CREATE INDEX IF NOT EXISTS platform_store_snapshots_updated_at_idx");
    expect(client.statements[2]).toContain("CREATE TABLE IF NOT EXISTS platform_schema_migrations");
    expect(client.statements[3]).toContain("SELECT id FROM platform_schema_migrations");
    expect(client.statements[4]).toBe(platformPostgresMigrationStatements[0]);
    expect(client.statements.at(-1)).toContain("INSERT INTO platform_schema_migrations");
  });

  it("upgrades an existing v1 database to support paused live rooms", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.transactionCount).toBe(1);
    expect(client.statements).toContainEqual(
      expect.stringContaining("DROP CONSTRAINT IF EXISTS draft_rooms_status_check"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("status IN ('setup', 'countdown', 'live', 'paused', 'ended')"),
    );
  });

  it("skips every schema statement when all migrations are applied", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");
    client.appliedMigrationIds.add("platform-live-room-paused-v2");
    client.appliedMigrationIds.add("platform-invitations-v3");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result).toEqual({ statementCount: 0 });
    expect(client.transactionCount).toBe(1);
    expect(client.statements.filter(statement => statement.includes("SELECT id"))).toHaveLength(3);
  });

  it("adds durable league invitations to an existing platform database", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");
    client.appliedMigrationIds.add("platform-live-room-paused-v2");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS league_invitations"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("league_invitations_pending_team_key"),
    );
  });

  it("reports every required migration missing from the migration ledger", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");

    await expect(findMissingPlatformPostgresMigrations(client)).resolves.toEqual([
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
    ]);
    expect(requiredPlatformPostgresMigrationIds).toEqual([
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
    ]);
  });
});
