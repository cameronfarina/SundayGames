import type {
  PlatformProductionReadinessCheck,
  PlatformRuntimeEnv,
} from "./contracts.js";
import { errorMessage, optionalEnvString, positiveIntegerEnv } from "./env.js";

export const liveDraftCheck = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessCheck => {
  const mode = optionalEnvString(env, "MOCKD_LIVE_DRAFT_DATA_MODE") ?? "postgres";
  if (mode === "postgres") {
    return {
      status: "pass",
      label: "Live draft data",
      detail: "Live draft data is configured for Postgres.",
    };
  }
  return {
    status: "fail",
    label: "Live draft data",
    detail: mode === "local-fixtures"
      ? "MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is local-only."
      : "MOCKD_LIVE_DRAFT_DATA_MODE must be postgres for production/domain readiness.",
  };
};

export const privateStorageCheck = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessCheck =>
  optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") === undefined
    ? {
      status: "fail",
      label: "Private draft storage",
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY must point to a persistent volume.",
    }
    : {
      status: "pass",
      label: "Private draft storage",
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is configured.",
    };

export interface BindCheckResult {
  check: PlatformProductionReadinessCheck;
  port: number | undefined;
}

export const bindCheck = (env: PlatformRuntimeEnv, host: string): BindCheckResult => {
  if (optionalEnvString(env, "PORT") === undefined) {
    return {
      port: undefined,
      check: {
        status: "fail",
        label: "Web bind target",
        detail: "PORT is required for production/domain readiness.",
      },
    };
  }
  try {
    const port = positiveIntegerEnv(env, "PORT", 0);
    return {
      port,
      check: {
        status: "pass",
        label: "Web bind target",
        detail: `Host ${host}, port ${port}.`,
      },
    };
  } catch (error) {
    return {
      port: undefined,
      check: {
        status: "fail",
        label: "Web bind target",
        detail: errorMessage(error),
      },
    };
  }
};

export const screenshotCheck = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessCheck => {
  const mode = optionalEnvString(env, "MOCKD_SCREENSHOT_IMPORT_MODE") ?? "disabled";
  const apiKey = optionalEnvString(env, "OPENAI_API_KEY");
  if (mode === "disabled") {
    return {
      status: "pass",
      label: "Screenshot import",
      detail: "Commissioner setup uses manual entry; OpenAI screenshot analysis is optional.",
    };
  }
  if (mode === "openai" && apiKey !== undefined) {
    return {
      status: "pass",
      label: "Screenshot import",
      detail: "OpenAI screenshot analysis is configured.",
    };
  }
  return {
    status: "fail",
    label: "Screenshot import",
    detail: mode === "openai"
      ? "OPENAI_API_KEY is required when screenshot import mode is openai."
      : "MOCKD_SCREENSHOT_IMPORT_MODE must be disabled or openai.",
  };
};
