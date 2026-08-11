import { pathToFileURL } from "node:url";
import { createAuthService, normalizeEmail, type AuthRepository } from "./auth.js";
import { readSinglePassword, type PasswordInput } from "./passwordInput.js";
import { PostgresAuthRepository } from "./postgresAuth.js";
import { createNodePostgresClient } from "./postgresClient.js";
import {
  readPlatformRuntimeConfig,
  type PlatformRuntimeConfig,
  type PlatformRuntimeEnv,
} from "./platformRuntimeConfig.js";

interface TextOutput {
  write(chunk: string): unknown;
}

export interface PasswordResetRuntime {
  repository: AuthRepository;
  close(): Promise<void>;
}

export interface ProductionPasswordResetCliOptions {
  arguments?: readonly string[] | undefined;
  env?: PlatformRuntimeEnv | undefined;
  stdin?: PasswordInput | undefined;
  stdout?: TextOutput | undefined;
  stderr?: TextOutput | undefined;
  now?: Date | undefined;
  createRuntime?: ((config: PlatformRuntimeConfig) => PasswordResetRuntime) | undefined;
}

const successMessage = "Password reset complete.\n";
const failureMessage = "Password reset failed.\n";
const cleanupWarningMessage = "Password reset complete, but database cleanup failed.\n";

const defaultRuntime = (config: PlatformRuntimeConfig): PasswordResetRuntime => {
  if (config.databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  const client = createNodePostgresClient({
    databaseUrl: config.databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });

  return {
    repository: new PostgresAuthRepository(client),
    close: async () => await client.close(),
  };
};

export const runProductionPasswordResetCli = async (
  options: ProductionPasswordResetCliOptions = {},
): Promise<number> => {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  let runtime: PasswordResetRuntime | undefined;
  let exitCode = 1;

  try {
    if ((options.arguments ?? process.argv.slice(2)).length > 0) {
      throw new Error("Command-line arguments are not supported.");
    }
    const env = options.env ?? process.env;
    const email = normalizeEmail(env.MOCKD_PASSWORD_RESET_EMAIL ?? "");
    const newPassword = await readSinglePassword(options.stdin ?? process.stdin);
    const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
    runtime = (options.createRuntime ?? defaultRuntime)(config);
    const result = await createAuthService({ repository: runtime.repository }).resetPassword({
      email,
      newPassword,
      now: options.now,
    });
    if (result === null) throw new Error("Account was not found.");

    stdout.write(successMessage);
    exitCode = 0;
  } catch {
    stderr.write(failureMessage);
  }

  try {
    await runtime?.close();
  } catch {
    if (exitCode === 0) stderr.write(cleanupWarningMessage);
  }

  return exitCode;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runProductionPasswordResetCli();
}
