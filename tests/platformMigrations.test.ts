import { describe, expect, it } from "vitest";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";

class RecordingPostgresClient implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  existingMigrationId: string | undefined;
  transactionCount = 0;

  async query<TRow = Record<string, unknown>>(
    text: string,
    _values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.statements.push(text);
    if (text.includes("SELECT id FROM platform_schema_migrations")) {
      return {
        rows: this.existingMigrationId === undefined ? [] : [{ id: this.existingMigrationId } as TRow],
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

    expect(result.statementCount).toBe(platformPostgresMigrationStatements.length + 2);
    expect(client.transactionCount).toBe(1);
    expect(client.statements[0]).toContain("CREATE TABLE IF NOT EXISTS platform_store_snapshots");
    expect(client.statements[1]).toContain("CREATE INDEX IF NOT EXISTS platform_store_snapshots_updated_at_idx");
    expect(client.statements[2]).toContain("CREATE TABLE IF NOT EXISTS platform_schema_migrations");
    expect(client.statements[3]).toContain("SELECT id FROM platform_schema_migrations");
    expect(client.statements[4]).toBe(platformPostgresMigrationStatements[0]);
    expect(client.statements.at(-1)).toContain("INSERT INTO platform_schema_migrations");
  });

  it("skips normalized schema statements when the migration ledger is already applied", async () => {
    const client = new RecordingPostgresClient();
    client.existingMigrationId = "platform-schema-v1";

    const result = await applyPlatformPostgresMigrations(client);

    expect(result).toEqual({ statementCount: 0 });
    expect(client.transactionCount).toBe(1);
    expect(client.statements).toEqual([
      expect.stringContaining("CREATE TABLE IF NOT EXISTS platform_store_snapshots"),
      expect.stringContaining("CREATE INDEX IF NOT EXISTS platform_store_snapshots_updated_at_idx"),
      expect.stringContaining("CREATE TABLE IF NOT EXISTS platform_schema_migrations"),
      expect.stringContaining("SELECT id FROM platform_schema_migrations"),
    ]);
  });
});
