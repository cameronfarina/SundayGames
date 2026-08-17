import type { PostgresTransactionalQueryClient } from "../../../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../../../src/platform/postgresPlatformStore.js";
import { FakePostgresAuthClient } from "./fakeAuthPostgresClient.js";
import { FakePostgresClient } from "./fakeSnapshotPostgresClient.js";
import { normalizeSql, stringValueAt } from "./postgresRowUtilities.js";

export class FakeTransactionalPostgresAuthClient
  extends FakePostgresAuthClient
  implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  readonly appliedMigrations = new Set<string>();

  override query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  override async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.statements.push(text);
    const normalizedSql = normalizeSql(text);

    if (
      normalizedSql.startsWith("CREATE TABLE") ||
      normalizedSql.startsWith("CREATE INDEX") ||
      normalizedSql.startsWith("CREATE UNIQUE INDEX") ||
      normalizedSql.startsWith("ALTER TABLE") ||
      normalizedSql.startsWith("DROP INDEX") ||
      normalizedSql.startsWith("DO $$") ||
      normalizedSql.startsWith("UPDATE accounts SET email_verified_at")
    ) {
      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT id FROM platform_schema_migrations")) {
      const migrationId = stringValueAt(values, 0);

      return {
        rows: this.appliedMigrations.has(migrationId) ? [{ id: migrationId }] : [],
      };
    }

    if (normalizedSql.startsWith("INSERT INTO platform_schema_migrations")) {
      const migrationId = stringValueAt(values, 0);
      this.appliedMigrations.add(migrationId);

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
      return { rows: [] };
    }

    if (
      normalizedSql.includes("FROM draft_rooms") &&
      normalizedSql.includes("HAVING COUNT(*) > 1")
    ) {
      return { rows: [] };
    }

    return await super.query(text, values);
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }
}

export class FakeTransactionalPostgresClient extends FakePostgresClient implements PostgresTransactionalQueryClient {
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return operation(this);
  }
}
