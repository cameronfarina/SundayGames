import { createPostgresBackup } from "./create-backup.js";

interface PostgresBackupCliDependencies {
  createBackup?: typeof createPostgresBackup | undefined;
  writeOutput?: ((output: string) => void) | undefined;
  writeError?: ((output: string) => void) | undefined;
}

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
  dependencies: PostgresBackupCliDependencies = {},
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
