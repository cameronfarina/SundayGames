import type { PostgresTransactionalQueryClient } from "../../../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../../../src/platform/postgresPlatformStore.js";
import { FakePostgresAuthClient } from "./fakeAuthPostgresClient.js";
import { FakePostgresClient } from "./fakeSnapshotPostgresClient.js";
import { fakeAuthRateLimitQuery } from "./fakeAuthRateLimitQuery.js";
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
      normalizedSql.startsWith("CREATE OR REPLACE FUNCTION") ||
      normalizedSql.startsWith("CREATE TRIGGER") ||
      normalizedSql.startsWith("ALTER TABLE") ||
      normalizedSql.startsWith("DROP INDEX") ||
      normalizedSql.startsWith("DROP TRIGGER") ||
      normalizedSql.startsWith("DO $$") ||
      normalizedSql.startsWith("INSERT INTO platform_practice_persistence_control") ||
      normalizedSql.startsWith("UPDATE platform_store_snapshots") ||
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

    if (normalizedSql.startsWith("UPDATE platform_practice_persistence_control")) {
      return { rows: [{ mode: "normalized-only" }] };
    }

    if (normalizedSql.startsWith("SELECT snapshot_key, revision, snapshot_json")) {
      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT revision, snapshot_json FROM platform_store_snapshots")) {
      return { rows: [] };
    }

    const authRateLimitResult = fakeAuthRateLimitQuery(normalizedSql);
    if (authRateLimitResult !== undefined) return authRateLimitResult;

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
