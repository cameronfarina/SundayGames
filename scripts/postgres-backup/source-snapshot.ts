import { createNodePostgresClient } from "../../src/platform/postgresClient.js";
import type { PostgresQueryClient } from "../../src/platform/postgresPlatformStore.js";
import { nonNegativeInteger, readCriticalTableCounts } from "./critical-tables.js";
import type {
  PostgresBackupSourceSnapshot,
  PostgresSourceSnapshotRunner,
} from "./contracts.js";
import { databaseNameFromPostgresUrl } from "./database-url.js";

interface SourceSnapshotRow {
  database_name: unknown;
  database_oid: unknown;
  server_address: unknown;
  server_port: unknown;
  snapshot_id: unknown;
}

const snapshotFromRow = async (
  row: SourceSnapshotRow | undefined,
  expectedDatabaseName: string,
  client: PostgresQueryClient,
): Promise<PostgresBackupSourceSnapshot> => {
  if (row === undefined ||
    typeof row.database_name !== "string" ||
    typeof row.database_oid !== "string" ||
    typeof row.server_address !== "string" ||
    typeof row.snapshot_id !== "string") {
    throw new Error("Could not identify the Postgres backup source.");
  }
  if (row.database_name !== expectedDatabaseName) {
    throw new Error("DATABASE_URL resolved to a different database name than configured.");
  }

  return {
    snapshotId: row.snapshot_id,
    database: {
      databaseName: row.database_name,
      databaseOid: row.database_oid,
      serverAddress: row.server_address,
      serverPort: nonNegativeInteger(row.server_port, "server port"),
    },
    criticalTableCounts: await readCriticalTableCounts(client),
  };
};

export const withPostgresSourceSnapshot: PostgresSourceSnapshotRunner = async (
  databaseUrl,
  operation,
) => {
  const expectedDatabaseName = databaseNameFromPostgresUrl(databaseUrl);
  const postgresClient = createNodePostgresClient({
    databaseUrl,
    max: 1,
    statementTimeoutMs: 30_000,
  });

  try {
    const connection = await postgresClient.pool.connect();
    try {
      await connection.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      try {
        const result = await connection.query<SourceSnapshotRow>(`
          SELECT
            current_database() AS database_name,
            (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database())
              AS database_oid,
            COALESCE(inet_server_addr()::text, 'local') AS server_address,
            inet_server_port() AS server_port,
            pg_export_snapshot() AS snapshot_id
        `);
        const queryClient: PostgresQueryClient = {
          query: async <TRow = Record<string, unknown>>(
            text: string,
            values: readonly unknown[] = [],
          ) => connection.query<TRow>(text, values),
        };
        const snapshot = await snapshotFromRow(
          result.rows[0],
          expectedDatabaseName,
          queryClient,
        );
        const operationResult = await operation(snapshot);
        await connection.query("COMMIT");

        return operationResult;
      } catch (error) {
        await connection.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    } finally {
      connection.release();
    }
  } finally {
    await postgresClient.close();
  }
};
