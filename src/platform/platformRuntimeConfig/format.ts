import type {
  PlatformProductionReadinessReport,
  PlatformProductionReadinessStorage,
} from "./contracts.js";

const storageDescription = (storage: PlatformProductionReadinessStorage): string => {
  switch (storage.kind) {
    case "postgres":
      return `Postgres (${storage.envKey})`;
    case "file":
      return `File-backed local store (${storage.dataFilePath})`;
    case "ambiguous":
      return `Postgres (${storage.databaseEnvKey}) plus file-backed local store (${storage.dataFilePath})`;
    case "missing":
      return "Missing";
  }
};

export const formatPlatformProductionReadinessReport = (
  report: PlatformProductionReadinessReport,
): string => {
  const status = report.ready ? "READY" : "BLOCKED";
  const bindTarget = report.port === undefined
    ? `${report.host}:<missing PORT>`
    : `${report.host}:${report.port}`;
  return [
    `Mockd production/domain readiness: ${status}`,
    `Storage: ${storageDescription(report.storage)}`,
    `Web bind: ${bindTarget}`,
    "",
    "Checks:",
    ...report.checks.map(
      check => `${check.status.toUpperCase()} ${check.label} - ${check.detail}`,
    ),
    "",
    "Next steps:",
    ...report.nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
};

export const platformProductionReadinessExitCode = (
  report: Pick<PlatformProductionReadinessReport, "ready">,
): 0 | 1 => report.ready ? 0 : 1;
