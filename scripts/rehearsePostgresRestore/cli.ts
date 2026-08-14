import { rehearsePostgresRestore } from "./rehearsal.js";

interface RestoreCliOptions {
  backupPath: string | undefined;
  manifestPath: string | undefined;
  projectRoot: string | undefined;
}

interface RestoreOptionDefinition {
  option: string;
  key: keyof RestoreCliOptions;
}

interface RestoreCliDependencies {
  rehearseRestore?: typeof rehearsePostgresRestore | undefined;
  writeOutput?: ((output: string) => void) | undefined;
  writeError?: ((output: string) => void) | undefined;
}

const optionDefinitions: readonly RestoreOptionDefinition[] = [
  { option: "--backup", key: "backupPath" },
  { option: "--manifest", key: "manifestPath" },
  { option: "--project-root", key: "projectRoot" },
];

const restoreOptionsFromArgs = (args: readonly string[]): RestoreCliOptions => {
  const parsed: RestoreCliOptions = {
    backupPath: undefined,
    manifestPath: undefined,
    projectRoot: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) throw new Error("Unknown restore option: undefined");
    const inline = optionDefinitions.find(
      definition => argument.startsWith(`${definition.option}=`),
    );
    if (inline !== undefined) {
      parsed[inline.key] = argument.slice(inline.option.length + 1);
      continue;
    }
    const definition = optionDefinitions.find(candidate => candidate.option === argument);
    if (definition === undefined) throw new Error(`Unknown restore option: ${argument}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    parsed[definition.key] = value;
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
  dependencies: RestoreCliDependencies = {},
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
