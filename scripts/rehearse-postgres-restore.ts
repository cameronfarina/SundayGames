import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createNodePostgresClient } from "../src/platform/postgresClient.js";
import {
  criticalApplicationTables,
  inspectCriticalTableCounts,
  postgresCommandEnvironment,
  runPostgresCommand,
  sha256File,
  type CriticalTableCounts,
  type PostgresBackupManifest,
  type PostgresCommandRunner,
  type PostgresDatabaseIdentity,
} from "./backup-postgres.js";

export interface PostgresDatabaseInspection extends PostgresDatabaseIdentity {
  userTableCount: number;
}

export interface RehearsePostgresRestoreOptions {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  backupPath: string;
  manifestPath?: string | undefined;
  projectRoot?: string | undefined;
}

export interface RehearsePostgresRestoreDependencies {
  inspectDatabase?: ((databaseUrl: string) => Promise<PostgresDatabaseInspection>) | undefined;
  inspectCriticalTableCounts?: ((databaseUrl: string) => Promise<CriticalTableCounts>) | undefined;
  now?: (() => Date) | undefined;
  runCommand?: PostgresCommandRunner | undefined;
  sha256File?: ((path: string) => Promise<string>) | undefined;
}

export interface PostgresRestoreRehearsalResult {
  schemaVersion: 1;
  kind: "mockd-postgres-restore-rehearsal";
  status: "passed";
  startedAt: string;
  completedAt: string;
  backup: {
    file: string;
    sizeBytes: number;
    sha256: string;
  };
  target: {
    databaseName: string;
    criticalTableCounts: CriticalTableCounts;
  };
  checks: readonly [
    "backup-integrity",
    "isolated-empty-target",
    "pg-restore",
    "compiled-migrations",
    "compiled-readiness",
    "critical-record-counts",
  ];
}

interface PostgresEndpoint {
  host: string;
  port: string;
  databaseName: string;
}

interface InspectionRow {
  database_name: unknown;
  database_oid: unknown;
  server_address: unknown;
  server_port: unknown;
  user_table_count: unknown;
}

const parsePostgresEndpoint = (databaseUrl: string, label: string): PostgresEndpoint => {
  if (databaseUrl.trim().length === 0) throw new Error(`${label} is required.`);

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`${label} must be a postgres:// or postgresql:// URL.`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${label} must be a postgres:// or postgresql:// URL.`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.hostname.length === 0 || databaseName.length === 0) {
    throw new Error(`${label} must include a host and database name.`);
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    databaseName,
  };
};

const assertDistinctConfiguredDatabases = (
  source: PostgresEndpoint,
  target: PostgresEndpoint,
): void => {
  const sameEndpoint = source.host === target.host &&
    source.port === target.port &&
    source.databaseName === target.databaseName;
  if (sameEndpoint || source.databaseName === target.databaseName) {
    throw new Error(
      "Restore target must use a different host, port, or database name than DATABASE_URL; "
      + "the target database name must be dedicated to the rehearsal.",
    );
  }
};

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

const isPostgresDatabaseIdentity = (value: unknown): value is PostgresDatabaseIdentity =>
  value !== null && typeof value === "object" &&
  "databaseName" in value && typeof value.databaseName === "string" &&
  value.databaseName.length > 0 &&
  "databaseOid" in value && typeof value.databaseOid === "string" &&
  /^\d+$/.test(value.databaseOid) &&
  "serverAddress" in value && typeof value.serverAddress === "string" &&
  value.serverAddress.length > 0 &&
  "serverPort" in value && typeof value.serverPort === "number" &&
  Number.isSafeInteger(value.serverPort) && value.serverPort > 0;

const isCriticalTableCounts = (value: unknown): value is CriticalTableCounts => {
  if (value === null || typeof value !== "object") return false;
  if (Object.keys(value).length !== criticalApplicationTables.length) return false;

  return criticalApplicationTables.every(table => {
    const count: unknown = Reflect.get(value, table);

    return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  });
};

const isBackupManifest = (value: unknown): value is PostgresBackupManifest => {
  if (value === null || typeof value !== "object") return false;

  return "schemaVersion" in value && value.schemaVersion === 2 &&
    "kind" in value && value.kind === "mockd-postgres-backup" &&
    "format" in value && value.format === "pg_dump-custom" &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "file" in value && typeof value.file === "string" &&
    "sizeBytes" in value && typeof value.sizeBytes === "number" &&
    Number.isSafeInteger(value.sizeBytes) &&
    value.sizeBytes > 0 &&
    "sha256" in value && typeof value.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    "sourceDatabase" in value && isPostgresDatabaseIdentity(value.sourceDatabase) &&
    "criticalTableCounts" in value && isCriticalTableCounts(value.criticalTableCounts);
};

const sameDatabaseIdentity = (
  expected: PostgresDatabaseIdentity,
  actual: PostgresDatabaseIdentity,
): boolean => expected.databaseName === actual.databaseName &&
  expected.databaseOid === actual.databaseOid &&
  expected.serverAddress === actual.serverAddress &&
  expected.serverPort === actual.serverPort;

const assertCriticalTableCountsMatch = (
  expected: CriticalTableCounts,
  actual: CriticalTableCounts,
): void => {
  const mismatches = criticalApplicationTables.flatMap(table =>
    expected[table] === actual[table]
      ? []
      : [`${table} expected ${expected[table]}, restored ${actual[table]}`]
  );
  if (mismatches.length > 0) {
    throw new Error(`Critical table counts do not match backup manifest: ${mismatches.join("; ")}.`);
  }
};

const readAndVerifyBackup = async (
  backupPath: string,
  manifestPath: string,
  hashFile: (path: string) => Promise<string>,
): Promise<PostgresBackupManifest> => {
  const parsedManifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isBackupManifest(parsedManifest)) throw new Error("Backup manifest is invalid.");
  if (parsedManifest.file !== basename(backupPath)) {
    throw new Error("Backup file name does not match its manifest.");
  }

  const backupStats = await stat(backupPath);
  if (!backupStats.isFile()) throw new Error("Backup path is not a regular file.");
  if (backupStats.size !== parsedManifest.sizeBytes) {
    throw new Error("Backup size does not match its manifest.");
  }
  if (await hashFile(backupPath) !== parsedManifest.sha256) {
    throw new Error("Backup SHA-256 does not match its manifest.");
  }

  return parsedManifest;
};

const environmentForTarget = (targetDatabaseUrl: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: targetDatabaseUrl,
    HOST: "127.0.0.1",
    PORT: "1",
    MOCKD_ALLOW_PUBLIC_SIGNUP: "false",
    MOCKD_LIVE_DRAFT_DATA_MODE: "postgres",
    NODE_ENV: "production",
  };
  delete env.MOCKD_DATABASE_URL;
  delete env.MOCKD_PLATFORM_DATA_FILE;
  delete env.PGDATABASE;

  return env;
};

const pgRestoreEnvironment = (targetDatabaseUrl: string): NodeJS.ProcessEnv => {
  return postgresCommandEnvironment(targetDatabaseUrl);
};

export const rehearsePostgresRestore = async (
  options: RehearsePostgresRestoreOptions,
  dependencies: RehearsePostgresRestoreDependencies = {},
): Promise<PostgresRestoreRehearsalResult> => {
  const sourceEndpoint = parsePostgresEndpoint(options.sourceDatabaseUrl, "DATABASE_URL");
  const targetEndpoint = parsePostgresEndpoint(
    options.targetDatabaseUrl,
    "MOCKD_RESTORE_TARGET_DATABASE_URL",
  );
  assertDistinctConfiguredDatabases(sourceEndpoint, targetEndpoint);
  if (options.backupPath.trim().length === 0) throw new Error("Backup path is required.");

  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const backupPath = resolve(options.backupPath);
  const manifestPath = resolve(options.manifestPath ?? `${backupPath}.manifest.json`);
  const manifest = await readAndVerifyBackup(
    backupPath,
    manifestPath,
    dependencies.sha256File ?? sha256File,
  );
  const inspectDatabase = dependencies.inspectDatabase ?? inspectPostgresDatabase;
  const sourceInspection = await inspectDatabase(options.sourceDatabaseUrl);
  if (!sameDatabaseIdentity(manifest.sourceDatabase, sourceInspection)) {
    throw new Error("Backup source database identity does not match DATABASE_URL.");
  }
  const targetInspection = await inspectDatabase(options.targetDatabaseUrl);
  if (sourceInspection.databaseName === targetInspection.databaseName) {
    throw new Error("Restore target resolved to the source database name; refusing to continue.");
  }
  if (targetInspection.databaseName !== targetEndpoint.databaseName) {
    throw new Error("Restore target URL did not resolve to its configured database name.");
  }
  if (targetInspection.userTableCount !== 0) {
    const noun = targetInspection.userTableCount === 1 ? "table" : "tables";
    throw new Error(
      `Restore target must be empty; found ${targetInspection.userTableCount} user ${noun}.`,
    );
  }

  const runCommand = dependencies.runCommand ?? runPostgresCommand;
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const readinessDirectory = await mkdtemp(join(tmpdir(), "mockd-restore-readiness-"));

  try {
    await runCommand({
      command: "pg_restore",
      args: [
        "--format=custom",
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        `--dbname=${targetEndpoint.databaseName}`,
        backupPath,
      ],
      env: pgRestoreEnvironment(options.targetDatabaseUrl),
    });
    const targetEnv = environmentForTarget(options.targetDatabaseUrl);
    await runCommand({
      command: process.execPath,
      args: [join(projectRoot, "dist/src/platform/runPlatformMigrations.js")],
      env: targetEnv,
    });
    await runCommand({
      command: process.execPath,
      args: [join(projectRoot, "dist/src/platform/checkPlatformProductionReadiness.js")],
      env: {
        ...targetEnv,
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: readinessDirectory,
      },
    });
  } finally {
    await rm(readinessDirectory, { force: true, recursive: true });
  }
  const restoredCriticalTableCounts = await (
    dependencies.inspectCriticalTableCounts ?? inspectCriticalTableCounts
  )(options.targetDatabaseUrl);
  assertCriticalTableCountsMatch(manifest.criticalTableCounts, restoredCriticalTableCounts);

  return {
    schemaVersion: 1,
    kind: "mockd-postgres-restore-rehearsal",
    status: "passed",
    startedAt,
    completedAt: now().toISOString(),
    backup: {
      file: manifest.file,
      sizeBytes: manifest.sizeBytes,
      sha256: manifest.sha256,
    },
    target: {
      databaseName: targetInspection.databaseName,
      criticalTableCounts: restoredCriticalTableCounts,
    },
    checks: [
      "backup-integrity",
      "isolated-empty-target",
      "pg-restore",
      "compiled-migrations",
      "compiled-readiness",
      "critical-record-counts",
    ],
  };
};

interface RestoreCliOptions {
  backupPath: string | undefined;
  manifestPath: string | undefined;
  projectRoot: string | undefined;
}

const restoreOptionsFromArgs = (args: readonly string[]): RestoreCliOptions => {
  const parsed: RestoreCliOptions = {
    backupPath: undefined,
    manifestPath: undefined,
    projectRoot: undefined,
  };
  const keys = {
    "--backup": "backupPath",
    "--manifest": "manifestPath",
    "--project-root": "projectRoot",
  } as const;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const inline = Object.entries(keys).find(([option]) => argument?.startsWith(`${option}=`));
    if (inline !== undefined) {
      const [option, key] = inline;
      parsed[key] = argument?.slice(option.length + 1);
      continue;
    }
    const key = argument === "--backup"
      ? keys["--backup"]
      : argument === "--manifest"
        ? keys["--manifest"]
        : argument === "--project-root"
          ? keys["--project-root"]
          : undefined;
    if (key === undefined) throw new Error(`Unknown restore option: ${argument}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
};

const sanitizedErrorMessage = (error: unknown, secrets: readonly string[]): string => {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret.length > 0) message = message.replaceAll(secret, "[REDACTED]");
  }

  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED]");
};

export const runPostgresRestoreRehearsalCli = async (
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  dependencies: {
    rehearseRestore?: typeof rehearsePostgresRestore | undefined;
    writeOutput?: ((output: string) => void) | undefined;
    writeError?: ((output: string) => void) | undefined;
  } = {},
): Promise<number> => {
  const sourceDatabaseUrl = env.DATABASE_URL?.trim() ?? "";
  const targetDatabaseUrl = env.MOCKD_RESTORE_TARGET_DATABASE_URL?.trim() ?? "";
  const writeOutput = dependencies.writeOutput ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const parsed = restoreOptionsFromArgs(args);
    const backupPath = parsed.backupPath ?? env.MOCKD_POSTGRES_BACKUP_PATH?.trim();
    if (backupPath === undefined || backupPath.length === 0) {
      throw new Error("Provide --backup or MOCKD_POSTGRES_BACKUP_PATH.");
    }
    const result = await (dependencies.rehearseRestore ?? rehearsePostgresRestore)({
      sourceDatabaseUrl,
      targetDatabaseUrl,
      backupPath,
      ...(parsed.manifestPath === undefined ? {} : { manifestPath: parsed.manifestPath }),
      ...(parsed.projectRoot === undefined ? {} : { projectRoot: parsed.projectRoot }),
    });
    writeOutput(JSON.stringify(result));

    return 0;
  } catch (error) {
    writeError(JSON.stringify({
      schemaVersion: 1,
      kind: "mockd-postgres-restore-rehearsal",
      status: "failed",
      error: sanitizedErrorMessage(error, [sourceDatabaseUrl, targetDatabaseUrl]),
    }));

    return 1;
  }
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPostgresRestoreRehearsalCli().then(exitCode => {
    process.exitCode = exitCode;
  });
}
