import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PostgresAuthRepository } from "./postgresAuth.js";
import { createNodePostgresClient } from "./postgresClient.js";
import { PostgresLeagueSetupRepository } from "./postgresLeagueSetup.js";
import { PostgresLiveDraftRoomSetupRepository } from "./liveDraftRoomSetups.js";
import {
  executeProductionProvisioning,
  parseProductionProvisioningDocument,
  type ProductionProvisioningMode,
  type ProductionProvisioningRepository,
  type ProductionProvisioningResult,
} from "./productionProvisioning.js";
import { PostgresProductionProvisioningRepository } from "./postgresProductionProvisioning.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import {
  readPlatformRuntimeConfig,
  type PlatformRuntimeConfig,
  type PlatformRuntimeEnv,
} from "./platformRuntimeConfig.js";

export interface ProductionProvisioningRuntime {
  repository: ProductionProvisioningRepository;
  close(): Promise<void>;
}

export interface ProductionProvisioningCliDependencies {
  readInputFile?: ((path: string) => Promise<string>) | undefined;
  createRuntime?: ((config: PlatformRuntimeConfig) => ProductionProvisioningRuntime) | undefined;
  writeOutput?: ((output: string) => void) | undefined;
}

export interface RunProductionProvisioningCliOptions {
  argv?: readonly string[] | undefined;
  env?: PlatformRuntimeEnv | undefined;
  now?: Date | undefined;
  dependencies?: ProductionProvisioningCliDependencies | undefined;
}

interface ParsedCliArguments {
  inputPath: string;
  mode: ProductionProvisioningMode;
}

const fixturePathPattern = /(?:^|[/\\._-])(e2e|fixtures?)(?:$|[/\\._-])/i;

const modeForFlags = (flags: readonly string[]): ProductionProvisioningMode => {
  if (flags.includes("--dry-run")) return "dry-run";
  if (flags.includes("--verify")) return "verify";

  return "apply";
};

const parseCliArguments = (argv: readonly string[]): ParsedCliArguments => {
  const inputPaths = argv.filter(argument => !argument.startsWith("--"));
  const flags = argv.filter(argument => argument.startsWith("--"));
  const unknownFlags = flags.filter(flag => flag !== "--dry-run" && flag !== "--verify");
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown production provisioning option: ${unknownFlags.join(", ")}.`);
  }
  if (inputPaths.length !== 1) {
    throw new Error("Usage: platform:provision <production.json> [--dry-run | --verify]");
  }
  if (flags.includes("--dry-run") && flags.includes("--verify")) {
    throw new Error("Use either --dry-run or --verify, not both.");
  }

  return {
    inputPath: resolve(inputPaths[0] ?? ""),
    mode: modeForFlags(flags),
  };
};

const assertPostgresUrl = (databaseUrl: string): void => {
  let protocol: string;
  try {
    protocol = new URL(databaseUrl).protocol;
  } catch {
    throw new Error("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }
  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }
};

const assertProductionInputPath = (inputPath: string): void => {
  if (fixturePathPattern.test(inputPath)) {
    throw new Error("Production provisioning refuses E2E or fixture input paths.");
  }
};

const productionRepositoryFor = (
  client: PostgresTransactionalQueryClient,
): PostgresProductionProvisioningRepository => new PostgresProductionProvisioningRepository({
  client,
  authRepository: new PostgresAuthRepository(client),
  leagueSetupRepository: new PostgresLeagueSetupRepository(client),
  draftSetupRepository: new PostgresLiveDraftRoomSetupRepository(client),
});

export const createTransactionalProductionProvisioningRepository = (
  client: PostgresTransactionalQueryClient,
): ProductionProvisioningRepository => {
  const repository = productionRepositoryFor(client);

  return {
    inspect: async (document, context) => await repository.inspect(document, context),
    verify: async (document, context) => await repository.verify(document, context),
    apply: async (document, context) => await client.transaction(async transactionClient => {
      const transactionScopedClient: PostgresTransactionalQueryClient = {
        query: async (text, values) => await transactionClient.query(text, values),
        transaction: async operation => await operation(transactionScopedClient),
      };
      const transactionRepository = productionRepositoryFor(transactionScopedClient);
      const inspection = await transactionRepository.inspect(document, context);
      if (inspection.conflicts.length > 0) {
        throw new Error(`Production provisioning conflicts:\n- ${inspection.conflicts.join("\n- ")}`);
      }
      if (
        inspection.auditRecorded &&
        inspection.changes.some(change => change.action !== "unchanged")
      ) {
        throw new Error(
          `Production provisioning audit receipt exists, but state differs for ${document.provisioningId}.`,
        );
      }

      await transactionRepository.apply(document, context);
    }),
  };
};

const defaultRuntime = (config: PlatformRuntimeConfig): ProductionProvisioningRuntime => {
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  const client = createNodePostgresClient({
    databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });

  return {
    repository: createTransactionalProductionProvisioningRepository(client),
    close: async () => await client.close(),
  };
};

export const runProductionProvisioningCli = async (
  options: RunProductionProvisioningCliOptions = {},
): Promise<ProductionProvisioningResult> => {
  const env = options.env ?? process.env;
  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  assertPostgresUrl(databaseUrl);

  const parsedArguments = parseCliArguments(options.argv ?? process.argv.slice(2));
  assertProductionInputPath(parsedArguments.inputPath);
  const inputContent = await (options.dependencies?.readInputFile ?? (async path => await readFile(path, "utf8")))(
    parsedArguments.inputPath,
  );
  const document = parseProductionProvisioningDocument(inputContent);
  const runtime = (options.dependencies?.createRuntime ?? defaultRuntime)(config);

  try {
    const result = await executeProductionProvisioning({
      mode: parsedArguments.mode,
      document,
      repository: runtime.repository,
      env,
      now: options.now,
    });
    (options.dependencies?.writeOutput ?? console.log)(JSON.stringify(result, null, 2));

    return result;
  } finally {
    await runtime.close();
  }
};

const run = async (): Promise<void> => {
  await runProductionProvisioningCli();
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
