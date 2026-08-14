import { readFile } from "node:fs/promises";
import {
  executeProductionProvisioning,
  parseProductionProvisioningDocument,
  type ProductionProvisioningResult,
} from "../productionProvisioning.js";
import { readPlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import { assertPostgresUrl, parseProvisioningArguments } from "./arguments.js";
import type { RunProductionProvisioningCliOptions } from "./contracts.js";
import { createProductionProvisioningRuntime } from "./runtime.js";

export const runProductionProvisioningCli = async (
  options: RunProductionProvisioningCliOptions = {},
): Promise<ProductionProvisioningResult> => {
  const env = options.env ?? process.env;
  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  assertPostgresUrl(databaseUrl);
  const parsedArguments = parseProvisioningArguments(options.argv ?? process.argv.slice(2));
  const readInput = options.dependencies?.readInputFile ?? (async path => await readFile(path, "utf8"));
  const document = parseProductionProvisioningDocument(await readInput(parsedArguments.inputPath));
  const runtime = (options.dependencies?.createRuntime ?? createProductionProvisioningRuntime)(config);
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
