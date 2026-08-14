import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  postgresCommandEnvironment,
  type PostgresCommandRunner,
} from "../backup-postgres.js";

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

export const runRestoreCommands = async (
  targetDatabaseUrl: string,
  targetDatabaseName: string,
  backupPath: string,
  projectRoot: string,
  runCommand: PostgresCommandRunner,
): Promise<void> => {
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
        `--dbname=${targetDatabaseName}`,
        backupPath,
      ],
      env: postgresCommandEnvironment(targetDatabaseUrl),
    });
    const targetEnv = environmentForTarget(targetDatabaseUrl);
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
};
