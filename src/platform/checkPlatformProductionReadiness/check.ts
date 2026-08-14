import {
  assessPlatformProductionReadiness,
  readPlatformRuntimeConfig,
  type PlatformProductionReadinessCheck,
  type PlatformProductionReadinessReport,
} from "../platformRuntimeConfig.js";
import type {
  PlatformDatabaseReadiness,
  PlatformProductionReadinessProbes,
} from "./contracts.js";
import { databaseChecksFor, probePlatformDatabase } from "./database.js";
import { probeWritableDraftToolsDirectory } from "./draftStorage.js";

const draftStorageCheck = (writable: boolean): PlatformProductionReadinessCheck =>
  writable
    ? {
        status: "pass",
        label: "Private draft storage write access",
        detail: "The configured private draft storage directory passed a write and delete probe.",
      }
    : {
        status: "fail",
        label: "Private draft storage write access",
        detail: "Could not write to and clean up the configured private draft storage directory.",
      };

export const checkPlatformProductionReadinessFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  probes: PlatformProductionReadinessProbes = {},
): Promise<PlatformProductionReadinessReport> => {
  const report = assessPlatformProductionReadiness(env);
  if (!report.ready) return report;
  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) return report;
  const databaseProbe = probes.probeDatabase ?? probePlatformDatabase;
  const storageProbe = probes.probeDraftStorage ?? probeWritableDraftToolsDirectory;
  const [databaseReadiness, storageWritable] = await Promise.all([
    databaseProbe(databaseUrl).catch(
      (): PlatformDatabaseReadiness => ({ status: "unreachable" }),
    ),
    storageProbe(config.draftToolsSessionDirectory).then(() => true, () => false),
  ]);
  const checks = [
    ...report.checks,
    ...databaseChecksFor(databaseReadiness),
    draftStorageCheck(storageWritable),
  ];
  return {
    ...report,
    ready: checks.every(check => check.status === "pass"),
    checks,
  };
};
