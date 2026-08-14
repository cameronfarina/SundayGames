import { createNodePostgresClient } from "../../src/platform/postgresClient.js";
import type { PostgresQueryClient } from "../../src/platform/postgresPlatformStore.js";
import {
  criticalApplicationTables,
  type CriticalApplicationTable,
  type CriticalTableCounts,
  type PostgresBackupSourceSnapshot,
} from "./contracts.js";

const productionProvisioningTables: readonly CriticalApplicationTable[] = [
  "accounts",
  "leagues",
  "league_seasons",
  "fantasy_teams",
  "players",
  "audit_events",
];

interface RelationPresenceRow {
  relation_name: unknown;
}

interface TableCountRow {
  row_count: unknown;
}

export const nonNegativeInteger = (value: unknown, label: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Postgres returned an invalid ${label}.`);
  }

  return parsed;
};

const countCriticalTable = async (
  client: PostgresQueryClient,
  table: CriticalApplicationTable,
): Promise<number> => {
  const presence = await client.query<RelationPresenceRow>(
    "SELECT to_regclass($1) AS relation_name",
    [`public.${table}`],
  );
  if (typeof presence.rows[0]?.relation_name !== "string") {
    throw new Error(`Expected Mockd schema is absent: critical table "${table}" is missing.`);
  }

  const count = await client.query<TableCountRow>(
    `SELECT COUNT(*)::text AS row_count FROM public."${table}"`,
  );
  const row = count.rows[0];
  if (row === undefined) throw new Error(`Could not count critical table "${table}".`);

  return nonNegativeInteger(row.row_count, `${table} record count`);
};

export const readCriticalTableCounts = async (
  client: PostgresQueryClient,
): Promise<CriticalTableCounts> => {
  const counts: Record<string, number> = {};
  for (const table of criticalApplicationTables) {
    counts[table] = await countCriticalTable(client, table);
  }

  return counts;
};

export const inspectCriticalTableCounts = async (
  databaseUrl: string,
): Promise<CriticalTableCounts> => {
  const client = createNodePostgresClient({
    databaseUrl,
    max: 1,
    statementTimeoutMs: 30_000,
  });

  try {
    return await readCriticalTableCounts(client);
  } finally {
    await client.close();
  }
};

export const validateSourceSnapshot = (
  snapshot: PostgresBackupSourceSnapshot,
  expectedDatabaseName: string,
): void => {
  if (snapshot.snapshotId.trim().length === 0) {
    throw new Error("Postgres did not export a usable backup snapshot.");
  }

  const database = snapshot.database;
  const invalidIdentity = database.databaseName !== expectedDatabaseName ||
    !/^\d+$/.test(database.databaseOid) ||
    database.serverAddress.trim().length === 0 ||
    !Number.isSafeInteger(database.serverPort) ||
    database.serverPort <= 0;
  if (invalidIdentity) {
    throw new Error("Postgres backup source identity is invalid or does not match DATABASE_URL.");
  }

  if (Object.keys(snapshot.criticalTableCounts).length !== criticalApplicationTables.length) {
    throw new Error("Postgres backup source did not report every critical table count.");
  }
  for (const table of criticalApplicationTables) {
    const count = snapshot.criticalTableCounts[table];
    if (count === undefined || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Postgres backup source returned an invalid ${table} record count.`);
    }
  }

  const emptyTables = productionProvisioningTables.filter(
    table => snapshot.criticalTableCounts[table] === 0,
  );
  if (emptyTables.length > 0) {
    throw new Error(
      `Postgres backup source has not been production provisioned; empty critical tables: ${emptyTables.join(", ")}.`,
    );
  }
};
