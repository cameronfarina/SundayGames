import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createNodePostgresClient } from "../src/platform/postgresClient.js";
import type { PostgresQueryClient } from "../src/platform/postgresPlatformStore.js";
import { platformPostgresSchema } from "../src/platform/postgresSchema.js";

export interface PostgresCommandInvocation {
  command: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
}

export type PostgresCommandRunner = (invocation: PostgresCommandInvocation) => Promise<void>;

export const criticalApplicationTables: readonly string[] = [
  "platform_schema_migrations",
  "platform_store_snapshots",
  ...platformPostgresSchema.tables.map(table => table.name),
  "league_invitations",
] as const;

export type CriticalApplicationTable = (typeof criticalApplicationTables)[number];
export type CriticalTableCounts = Readonly<Record<CriticalApplicationTable, number>>;

const productionProvisioningTables = [
  "accounts",
  "leagues",
  "league_seasons",
  "fantasy_teams",
  "players",
  "audit_events",
] as const satisfies readonly CriticalApplicationTable[];

export interface PostgresDatabaseIdentity {
  databaseName: string;
  databaseOid: string;
  serverAddress: string;
  serverPort: number;
}

export interface PostgresBackupSourceSnapshot {
  snapshotId: string;
  database: PostgresDatabaseIdentity;
  criticalTableCounts: CriticalTableCounts;
}

export type PostgresSourceSnapshotRunner = <T>(
  databaseUrl: string,
  operation: (snapshot: PostgresBackupSourceSnapshot) => Promise<T>,
) => Promise<T>;

export interface PostgresBackupManifest {
  schemaVersion: 2;
  kind: "mockd-postgres-backup";
  createdAt: string;
  format: "pg_dump-custom";
  file: string;
  sizeBytes: number;
  sha256: string;
  sourceDatabase: PostgresDatabaseIdentity;
  criticalTableCounts: CriticalTableCounts;
}

export interface CreatePostgresBackupOptions {
  databaseUrl: string;
  outputPath: string;
}

export interface CreatePostgresBackupDependencies {
  now?: (() => Date) | undefined;
  randomId?: (() => string) | undefined;
  runCommand?: PostgresCommandRunner | undefined;
  sha256File?: ((path: string) => Promise<string>) | undefined;
  withSourceSnapshot?: PostgresSourceSnapshotRunner | undefined;
}

export interface PostgresBackupResult {
  status: "completed";
  outputPath: string;
  manifestPath: string;
  manifest: PostgresBackupManifest;
}

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const databaseNameFromPostgresUrl = (databaseUrl: string): string => {
  if (databaseUrl.trim().length === 0) throw new Error("DATABASE_URL is required.");

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") {
      const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
      if (parsed.hostname.length > 0 && databaseName.length > 0) return databaseName;
    }
  } catch {
    // Report one stable validation message without echoing the connection string.
  }

  throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL.");
};

const libpqQueryEnvironmentKeys = {
  application_name: "PGAPPNAME",
  channel_binding: "PGCHANNELBINDING",
  connect_timeout: "PGCONNECT_TIMEOUT",
  options: "PGOPTIONS",
  sslcert: "PGSSLCERT",
  sslcrl: "PGSSLCRL",
  sslkey: "PGSSLKEY",
  sslmode: "PGSSLMODE",
  sslpassword: "PGSSLPASSWORD",
  sslrootcert: "PGSSLROOTCERT",
} as const;

export const postgresCommandEnvironment = (
  databaseUrl: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => {
  databaseNameFromPostgresUrl(databaseUrl);
  const parsed = new URL(databaseUrl);
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  for (const key of [
    "DATABASE_URL",
    "MOCKD_DATABASE_URL",
    "PGAPPNAME",
    "PGCHANNELBINDING",
    "PGCONNECT_TIMEOUT",
    "PGDATABASE",
    "PGHOST",
    "PGOPTIONS",
    "PGPASSWORD",
    "PGPORT",
    "PGSSLCERT",
    "PGSSLCRL",
    "PGSSLKEY",
    "PGSSLMODE",
    "PGSSLPASSWORD",
    "PGSSLROOTCERT",
    "PGUSER",
  ]) delete env[key];

  env.PGHOST = parsed.hostname;
  env.PGPORT = parsed.port || "5432";
  env.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.username.length > 0) env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password.length > 0) env.PGPASSWORD = decodeURIComponent(parsed.password);
  for (const [queryKey, envKey] of Object.entries(libpqQueryEnvironmentKeys)) {
    const value = parsed.searchParams.get(queryKey);
    if (value !== null && value.length > 0) env[envKey] = value;
  }

  return env;
};

interface SourceSnapshotRow {
  database_name: unknown;
  database_oid: unknown;
  server_address: unknown;
  server_port: unknown;
  snapshot_id: unknown;
}

interface RelationPresenceRow {
  relation_name: unknown;
}

interface TableCountRow {
  row_count: unknown;
}

const nonNegativeInteger = (value: unknown, label: string): number => {
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

const assertSourceSnapshot = (
  snapshot: PostgresBackupSourceSnapshot,
  expectedDatabaseName: string,
): void => {
  if (snapshot.snapshotId.trim().length === 0) {
    throw new Error("Postgres did not export a usable backup snapshot.");
  }
  if (snapshot.database.databaseName !== expectedDatabaseName ||
    !/^\d+$/.test(snapshot.database.databaseOid) ||
    snapshot.database.serverAddress.trim().length === 0 ||
    !Number.isSafeInteger(snapshot.database.serverPort) || snapshot.database.serverPort <= 0) {
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
  const emptyProvisioningTables = productionProvisioningTables.filter(
    table => snapshot.criticalTableCounts[table] === 0,
  );
  if (emptyProvisioningTables.length > 0) {
    throw new Error(
      `Postgres backup source has not been production provisioned; empty critical tables: ${emptyProvisioningTables.join(", ")}.`,
    );
  }
};

const readCriticalTableCounts = async (
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
  const client = createNodePostgresClient({ databaseUrl, max: 1, statementTimeoutMs: 30_000 });

  try {
    return await readCriticalTableCounts(client);
  } finally {
    await client.close();
  }
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
        const row = result.rows[0];
        if (row === undefined || typeof row.database_name !== "string" ||
          typeof row.database_oid !== "string" || typeof row.server_address !== "string" ||
          typeof row.snapshot_id !== "string") {
          throw new Error("Could not identify the Postgres backup source.");
        }
        if (row.database_name !== expectedDatabaseName) {
          throw new Error("DATABASE_URL resolved to a different database name than configured.");
        }
        const snapshot: PostgresBackupSourceSnapshot = {
          snapshotId: row.snapshot_id,
          database: {
            databaseName: row.database_name,
            databaseOid: row.database_oid,
            serverAddress: row.server_address,
            serverPort: nonNegativeInteger(row.server_port, "server port"),
          },
          criticalTableCounts: await readCriticalTableCounts({
            query: async <TRow = Record<string, unknown>>(
              text: string,
              values: readonly unknown[] = [],
            ) => connection.query<TRow>(text, values),
          }),
        };
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

const assertPathDoesNotExist = async (path: string, label: string): Promise<void> => {
  try {
    await lstat(path);
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }

  throw new Error(`${label} already exists: ${path}`);
};

export const runPostgresCommand: PostgresCommandRunner = async ({ command, args, env }) => {
  const child = spawn(command, [...args], { env, stdio: "ignore" });
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolveExit(code ?? 1));
  });

  if (exitCode !== 0) throw new Error(`${command} exited with code ${exitCode}.`);
};

export const sha256File = async (path: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);

  return hash.digest("hex");
};

export const createPostgresBackup = async (
  options: CreatePostgresBackupOptions,
  dependencies: CreatePostgresBackupDependencies = {},
): Promise<PostgresBackupResult> => {
  const expectedDatabaseName = databaseNameFromPostgresUrl(options.databaseUrl);
  if (options.outputPath.trim().length === 0) throw new Error("Backup output path is required.");

  const outputPath = resolve(options.outputPath);
  const manifestPath = `${outputPath}.manifest.json`;
  await assertPathDoesNotExist(outputPath, "Backup file");
  await assertPathDoesNotExist(manifestPath, "Backup manifest");

  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const randomId = (dependencies.randomId ?? randomUUID)();
  const temporaryOutputPath = join(outputDirectory, `.${basename(outputPath)}.${randomId}.tmp`);
  const temporaryManifestPath = `${temporaryOutputPath}.manifest.json`;
  const runCommand = dependencies.runCommand ?? runPostgresCommand;
  let publishedOutput = false;
  let publishedManifest = false;

  try {
    await assertPathDoesNotExist(temporaryOutputPath, "Temporary backup file");
    await assertPathDoesNotExist(temporaryManifestPath, "Temporary backup manifest");
    const sourceSnapshot = await (
      dependencies.withSourceSnapshot ?? withPostgresSourceSnapshot
    )(options.databaseUrl, async snapshot => {
      assertSourceSnapshot(snapshot, expectedDatabaseName);
      await runCommand({
        command: "pg_dump",
        args: [
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          `--snapshot=${snapshot.snapshotId}`,
          `--file=${temporaryOutputPath}`,
        ],
        env: postgresCommandEnvironment(options.databaseUrl),
      });

      return snapshot;
    });
    await chmod(temporaryOutputPath, 0o600);

    const backupStats = await stat(temporaryOutputPath);
    if (!backupStats.isFile() || backupStats.size === 0) {
      throw new Error("pg_dump did not produce a non-empty backup file.");
    }

    const digest = await (dependencies.sha256File ?? sha256File)(temporaryOutputPath);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Backup SHA-256 digest is invalid.");
    const manifest: PostgresBackupManifest = {
      schemaVersion: 2,
      kind: "mockd-postgres-backup",
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      format: "pg_dump-custom",
      file: basename(outputPath),
      sizeBytes: backupStats.size,
      sha256: digest,
      sourceDatabase: sourceSnapshot.database,
      criticalTableCounts: sourceSnapshot.criticalTableCounts,
    };
    await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });

    await link(temporaryOutputPath, outputPath);
    publishedOutput = true;
    await link(temporaryManifestPath, manifestPath);
    publishedManifest = true;

    return { status: "completed", outputPath, manifestPath, manifest };
  } catch (error) {
    if (publishedManifest) await rm(manifestPath, { force: true }).catch(() => undefined);
    if (publishedOutput) await rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await Promise.allSettled([
      rm(temporaryOutputPath, { force: true }),
      rm(temporaryManifestPath, { force: true }),
    ]);
  }
};

const outputPathFromArgs = (args: readonly string[]): string | undefined => {
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    let value: string | undefined;
    if (argument?.startsWith("--output=")) {
      value = argument.slice("--output=".length);
    } else if (argument === "--output") {
      value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--output requires a value.");
      }
      index += 1;
    } else {
      throw new Error(`Unknown backup option: ${argument}`);
    }
    if (outputPath !== undefined) throw new Error("--output may only be provided once.");
    outputPath = value;
  }

  return outputPath;
};

const sanitizedErrorMessage = (error: unknown, secrets: readonly string[]): string => {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret.length > 0) message = message.replaceAll(secret, "[REDACTED]");
  }

  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED]");
};

export const runPostgresBackupCli = async (
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  dependencies: {
    createBackup?: typeof createPostgresBackup | undefined;
    writeOutput?: ((output: string) => void) | undefined;
    writeError?: ((output: string) => void) | undefined;
  } = {},
): Promise<number> => {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const writeOutput = dependencies.writeOutput ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const outputPath = outputPathFromArgs(args) ?? env.MOCKD_POSTGRES_BACKUP_PATH?.trim();
    if (outputPath === undefined || outputPath.length === 0) {
      throw new Error("Provide --output or MOCKD_POSTGRES_BACKUP_PATH.");
    }
    const result = await (dependencies.createBackup ?? createPostgresBackup)({
      databaseUrl,
      outputPath,
    });
    writeOutput(JSON.stringify(result));

    return 0;
  } catch (error) {
    writeError(JSON.stringify({
      status: "failed",
      error: sanitizedErrorMessage(error, [databaseUrl]),
    }));

    return 1;
  }
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPostgresBackupCli().then(exitCode => {
    process.exitCode = exitCode;
  });
}
