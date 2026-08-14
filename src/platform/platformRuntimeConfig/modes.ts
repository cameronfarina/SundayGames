import { randomBytes } from "node:crypto";
import type { JobKind } from "../jobs.js";
import type {
  PlatformRuntimeConfig,
  PlatformRuntimeEnv,
  ScreenshotImportConfig,
} from "./contracts.js";
import {
  defaultScreenshotImportMaxConcurrency,
  defaultScreenshotImportMaxImageBytes,
  defaultScreenshotImportModel,
  defaultScreenshotImportTimeoutMs,
  defaultWorkerJobKinds,
  launchWorkerJobKinds,
} from "./defaults.js";
import { booleanEnv, optionalEnvString, positiveIntegerEnv } from "./env.js";

export const legacyMockBatchEnabled = (env: PlatformRuntimeEnv): boolean => {
  const enabled = booleanEnv(env, "MOCKD_ENABLE_LEGACY_MOCK_BATCH");
  if (enabled && optionalEnvString(env, "NODE_ENV") === "production") {
    throw new Error("MOCKD_ENABLE_LEGACY_MOCK_BATCH cannot be enabled in production.");
  }
  return enabled;
};

export const runtimeWorkerId = (env: PlatformRuntimeEnv): string =>
  optionalEnvString(env, "MOCKD_WORKER_ID") ??
  `worker_${randomBytes(8).toString("base64url")}`;

export const simulationDataMode = (
  env: PlatformRuntimeEnv,
): PlatformRuntimeConfig["simulationDataMode"] => {
  const value = optionalEnvString(env, "MOCKD_SIMULATION_DATA_MODE") ?? "disabled";
  if (value === "disabled" || value === "local-fixtures") return value;
  throw new Error("MOCKD_SIMULATION_DATA_MODE must be disabled or local-fixtures.");
};

export const liveDraftDataMode = (
  env: PlatformRuntimeEnv,
): PlatformRuntimeConfig["liveDraftDataMode"] => {
  const value = optionalEnvString(env, "MOCKD_LIVE_DRAFT_DATA_MODE") ?? "postgres";
  if (value !== "postgres" && value !== "local-fixtures") {
    throw new Error("MOCKD_LIVE_DRAFT_DATA_MODE must be postgres or local-fixtures.");
  }
  if (value === "local-fixtures" && optionalEnvString(env, "NODE_ENV") === "production") {
    throw new Error(
      "MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is only supported outside production.",
    );
  }
  return value;
};

export const screenshotImportConfig = (
  env: PlatformRuntimeEnv,
): ScreenshotImportConfig => {
  const mode = optionalEnvString(env, "MOCKD_SCREENSHOT_IMPORT_MODE") ?? "disabled";
  if (mode !== "disabled" && mode !== "openai") {
    throw new Error("MOCKD_SCREENSHOT_IMPORT_MODE must be disabled or openai.");
  }
  const apiKey = optionalEnvString(env, "OPENAI_API_KEY");
  if (mode === "openai" && apiKey === undefined) {
    throw new Error("OPENAI_API_KEY is required when screenshot import mode is openai.");
  }
  return {
    mode,
    apiKey,
    model: optionalEnvString(env, "MOCKD_SCREENSHOT_IMPORT_MODEL") ??
      defaultScreenshotImportModel,
    timeoutMs: positiveIntegerEnv(
      env,
      "MOCKD_SCREENSHOT_IMPORT_TIMEOUT_MS",
      defaultScreenshotImportTimeoutMs,
    ),
    maxImageBytes: positiveIntegerEnv(
      env,
      "MOCKD_SCREENSHOT_IMPORT_MAX_IMAGE_BYTES",
      defaultScreenshotImportMaxImageBytes,
    ),
    maxConcurrentRequests: positiveIntegerEnv(
      env,
      "MOCKD_SCREENSHOT_IMPORT_MAX_CONCURRENCY",
      defaultScreenshotImportMaxConcurrency,
    ),
  };
};

export const workerJobKinds = (env: PlatformRuntimeEnv): readonly JobKind[] => {
  const value = optionalEnvString(env, "MOCKD_WORKER_JOB_KINDS");
  if (value === undefined) return defaultWorkerJobKinds;
  return value.split(",").map(rawKind => {
    const kind = rawKind.trim();
    const supported = launchWorkerJobKinds.find(candidate => candidate === kind);
    if (supported === undefined) {
      throw new Error(
        `MOCKD_WORKER_JOB_KINDS contains unsupported launch job kind "${kind}".`,
      );
    }
    return supported;
  });
};
