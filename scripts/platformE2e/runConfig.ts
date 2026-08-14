import {
  defaultDeployedPreflightTimeoutMs,
  defaultServerStartupTimeoutMs,
  deployedSmokeEnvironment,
  deployedSmokeFields,
  localFixtureEnvironment,
  type DeployedPlatformSmokeConfig,
  type PlatformE2eEnv,
  type PlatformE2eRunConfig,
} from "./contracts.js";
import { optionalEnvFrom } from "./environment.js";
import { parseRunnerArgs } from "./runnerArguments.js";
import {
  normalizeBaseUrl,
  normalizeSmokeRunId,
  positiveIntegerEnv,
  targetValue,
} from "./valueParsers.js";

const deployedSmokeConfigFrom = (env: PlatformE2eEnv): DeployedPlatformSmokeConfig => {
  const values = deployedSmokeFields.map(field => ({
    environmentKey: deployedSmokeEnvironment[field],
    field,
    value: optionalEnvFrom(env, deployedSmokeEnvironment[field]),
  }));
  const missing = values.filter(item => item.value === undefined)
    .map(item => item.environmentKey);
  if (missing.length > 0) {
    throw new Error(
      `Deployed platform smoke requires pre-provisioned records. Missing: ${missing.join(", ")}.`,
    );
  }
  const requiredValue = (field: keyof DeployedPlatformSmokeConfig): string => {
    const environmentKey = deployedSmokeEnvironment[field];
    const value = optionalEnvFrom(env, environmentKey);
    if (value === undefined) throw new Error(`Missing ${environmentKey}.`);
    return value;
  };
  return {
    commissionerEmail: requiredValue("commissionerEmail"),
    commissionerPassword: requiredValue("commissionerPassword"),
    memberEmail: requiredValue("memberEmail"),
    memberPassword: requiredValue("memberPassword"),
    seasonId: requiredValue("seasonId"),
  };
};

const baseUrlSource = (
  argumentValue: string | undefined,
  environmentValue: string | undefined,
): string => {
  if (argumentValue !== undefined) return "--base-url";
  return environmentValue !== undefined ? "MOCKD_E2E_BASE_URL" : "PLAYWRIGHT_BASE_URL";
};

export const resolvePlatformE2eRunConfig = (
  env: PlatformE2eEnv = process.env,
  rawArgs: readonly string[] = process.argv.slice(2),
): PlatformE2eRunConfig => {
  const parsed = parseRunnerArgs(rawArgs);
  if (parsed.helpRequested) {
    return {
      target: parsed.target ?? "local",
      baseUrl: undefined,
      smokeRunId: undefined,
      deployedSmoke: undefined,
      playwrightArgs: parsed.playwrightArgs,
      serverStartupTimeoutMs: parsed.serverStartupTimeoutMs ?? defaultServerStartupTimeoutMs,
      deployedPreflightTimeoutMs:
        parsed.deployedPreflightTimeoutMs ?? defaultDeployedPreflightTimeoutMs,
      helpRequested: true,
    };
  }
  const environmentTarget = targetValue(
    optionalEnvFrom(env, "MOCKD_E2E_TARGET"),
    "MOCKD_E2E_TARGET",
  );
  const environmentUrl = optionalEnvFrom(env, "MOCKD_E2E_BASE_URL");
  const rawUrl = parsed.baseUrl ?? environmentUrl ?? optionalEnvFrom(env, "PLAYWRIGHT_BASE_URL");
  const baseUrl = rawUrl === undefined
    ? undefined
    : normalizeBaseUrl(rawUrl, baseUrlSource(parsed.baseUrl, environmentUrl));
  const target = parsed.target ?? environmentTarget ?? (baseUrl === undefined ? "local" : "deployed");
  if (target === "deployed" && baseUrl === undefined) {
    throw new Error("--base-url or MOCKD_E2E_BASE_URL is required for deployed platform smoke.");
  }
  if (target === "local" && baseUrl !== undefined) {
    throw new Error(
      "Use --target=deployed when providing --base-url, "
      + "MOCKD_E2E_BASE_URL, or PLAYWRIGHT_BASE_URL.",
    );
  }
  if (target === "deployed") {
    if (parsed.smokeRunId !== undefined) {
      throw new Error("--smoke-run-id only applies to local platform E2E runs.");
    }
    const localOnlyKey = localFixtureEnvironment.find(
      key => optionalEnvFrom(env, key) !== undefined,
    );
    if (localOnlyKey !== undefined) {
      throw new Error(`${localOnlyKey} only applies to local platform E2E runs.`);
    }
  }
  const rawRunId = parsed.smokeRunId ?? optionalEnvFrom(env, "MOCKD_E2E_RUN_ID");
  const smokeRunId = rawRunId === undefined
    ? undefined
    : normalizeSmokeRunId(
        rawRunId,
        parsed.smokeRunId === undefined ? "MOCKD_E2E_RUN_ID" : "--smoke-run-id",
      );
  return {
    target,
    baseUrl,
    smokeRunId,
    deployedSmoke: target === "deployed" ? deployedSmokeConfigFrom(env) : undefined,
    playwrightArgs: parsed.playwrightArgs,
    serverStartupTimeoutMs: parsed.serverStartupTimeoutMs
      ?? positiveIntegerEnv(
        env,
        "MOCKD_E2E_SERVER_STARTUP_TIMEOUT_MS",
        defaultServerStartupTimeoutMs,
      ),
    deployedPreflightTimeoutMs: parsed.deployedPreflightTimeoutMs
      ?? positiveIntegerEnv(
        env,
        "MOCKD_E2E_PREFLIGHT_TIMEOUT_MS",
        defaultDeployedPreflightTimeoutMs,
      ),
    helpRequested: false,
  };
};
