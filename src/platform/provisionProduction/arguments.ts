import { resolve } from "node:path";
import type { ProductionProvisioningMode } from "../productionProvisioning.js";

export interface ParsedProvisioningArguments {
  inputPath: string;
  mode: ProductionProvisioningMode;
}

const fixturePathPattern = /(?:^|[/\\._-])(e2e|fixtures?)(?:$|[/\\._-])/i;

const modeForFlags = (flags: readonly string[]): ProductionProvisioningMode => {
  if (flags.includes("--dry-run")) return "dry-run";
  return flags.includes("--verify") ? "verify" : "apply";
};

export const parseProvisioningArguments = (argv: readonly string[]): ParsedProvisioningArguments => {
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
  const inputPath = resolve(inputPaths[0] ?? "");
  if (fixturePathPattern.test(inputPath)) {
    throw new Error("Production provisioning refuses E2E or fixture input paths.");
  }
  return { inputPath, mode: modeForFlags(flags) };
};

export const assertPostgresUrl = (databaseUrl: string): void => {
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
