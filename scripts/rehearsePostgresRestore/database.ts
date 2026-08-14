import { createNodePostgresClient } from "../../src/platform/postgresClient.js";
import type { PostgresDatabaseIdentity } from "../backup-postgres.js";
import type { PostgresDatabaseInspection } from "./types.js";

interface InspectionRow {
  database_name: unknown;
  database_oid: unknown;
  server_address: unknown;
  server_port: unknown;
  user_table_count: unknown;
}

const numberValue = (value: unknown, label: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Database inspection returned an invalid ${label}.`);
  }

  return parsed;
};

export const inspectPostgresDatabase = async (
  databaseUrl: string,
): Promise<PostgresDatabaseInspection> => {
  const client = createNodePostgresClient({ databaseUrl, max: 1, statementTimeoutMs: 5_000 });

  try {
    const result = await client.query<InspectionRow>(`
      SELECT
        current_database() AS database_name,
        (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database())
          AS database_oid,
        COALESCE(inet_server_addr()::text, 'local') AS server_address,
        inet_server_port() AS server_port,
        (
          SELECT COUNT(*)::integer
          FROM pg_catalog.pg_class AS relation
          INNER JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
            AND namespace.nspname NOT LIKE 'pg_toast%'
            AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
        ) AS user_table_count
    `);
    const row = result.rows[0];
    if (row === undefined || typeof row.database_name !== "string" ||
      typeof row.database_oid !== "string" ||
      typeof row.server_address !== "string") {
      throw new Error("Database inspection did not return a usable identity.");
    }

    return {
      databaseName: row.database_name,
      databaseOid: row.database_oid,
      serverAddress: row.server_address,
      serverPort: numberValue(row.server_port, "server port"),
      userTableCount: numberValue(row.user_table_count, "user table count"),
    };
  } finally {
    await client.close();
  }
};

const sameIdentity = (
  expected: PostgresDatabaseIdentity,
  actual: PostgresDatabaseIdentity,
): boolean => expected.databaseName === actual.databaseName &&
  expected.databaseOid === actual.databaseOid &&
  expected.serverAddress === actual.serverAddress &&
  expected.serverPort === actual.serverPort;

export const inspectRestoreDatabases = async (
  sourceDatabaseUrl: string,
  targetDatabaseUrl: string,
  configuredTargetName: string,
  expectedSource: PostgresDatabaseIdentity,
  inspectDatabase: (databaseUrl: string) => Promise<PostgresDatabaseInspection>,
): Promise<PostgresDatabaseInspection> => {
  const source = await inspectDatabase(sourceDatabaseUrl);
  if (!sameIdentity(expectedSource, source)) {
    throw new Error("Backup source database identity does not match DATABASE_URL.");
  }
  const target = await inspectDatabase(targetDatabaseUrl);
  if (source.databaseName === target.databaseName) {
    throw new Error("Restore target resolved to the source database name; refusing to continue.");
  }
  if (target.databaseName !== configuredTargetName) {
    throw new Error("Restore target URL did not resolve to its configured database name.");
  }
  if (target.userTableCount !== 0) {
    const noun = target.userTableCount === 1 ? "table" : "tables";
    throw new Error(`Restore target must be empty; found ${target.userTableCount} user ${noun}.`);
  }

  return target;
};
