import type { ParsedRunnerArgs, PlatformE2eTarget } from "./contracts.js";
import { optionValue, positiveIntegerValue, targetValue } from "./valueParsers.js";

export const parseRunnerArgs = (rawArgs: readonly string[]): ParsedRunnerArgs => {
  const playwrightArgs: string[] = [];
  let target: PlatformE2eTarget | undefined;
  let baseUrl: string | undefined;
  let smokeRunId: string | undefined;
  let serverStartupTimeoutMs: number | undefined;
  let deployedPreflightTimeoutMs: number | undefined;
  let helpRequested = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (argument === undefined) continue;
    if (argument === "--") {
      playwrightArgs.push(...rawArgs.slice(index + 1));
      break;
    }
    if (argument === "--help" || argument === "-h") {
      helpRequested = true;
      continue;
    }
    if (argument === "--deployed" || argument === "--local") {
      target = argument === "--deployed" ? "deployed" : "local";
      continue;
    }
    const targetOption = optionValue(rawArgs, index, "--target");
    if (targetOption !== null) {
      target = targetValue(targetOption.value, "--target");
      index = targetOption.nextIndex;
      continue;
    }
    const baseUrlOption = optionValue(rawArgs, index, "--base-url");
    if (baseUrlOption !== null) {
      baseUrl = baseUrlOption.value;
      index = baseUrlOption.nextIndex;
      continue;
    }
    const smokeRunIdOption = optionValue(rawArgs, index, "--smoke-run-id");
    if (smokeRunIdOption !== null) {
      smokeRunId = smokeRunIdOption.value;
      index = smokeRunIdOption.nextIndex;
      continue;
    }
    const serverTimeout = optionValue(rawArgs, index, "--server-startup-timeout-ms");
    if (serverTimeout !== null) {
      serverStartupTimeoutMs = positiveIntegerValue(
        serverTimeout.value,
        "--server-startup-timeout-ms",
      );
      index = serverTimeout.nextIndex;
      continue;
    }
    const preflightTimeout = optionValue(rawArgs, index, "--preflight-timeout-ms");
    if (preflightTimeout !== null) {
      deployedPreflightTimeoutMs = positiveIntegerValue(
        preflightTimeout.value,
        "--preflight-timeout-ms",
      );
      index = preflightTimeout.nextIndex;
      continue;
    }
    playwrightArgs.push(argument);
  }

  return {
    target,
    baseUrl,
    smokeRunId,
    serverStartupTimeoutMs,
    deployedPreflightTimeoutMs,
    playwrightArgs,
    helpRequested,
  };
};

export const platformE2eRunnerUsage = [
  "Usage: npm run test:e2e -- [runner options] [Playwright options]",
  "",
  "Runner options:",
  "  --base-url=<url>                  Run against a deployed Mockd URL.",
  "  --target=local|deployed           Force local or deployed mode.",
  "  --smoke-run-id=<id>               Namespace local fixture records.",
  "  --server-startup-timeout-ms=<ms>  Local web startup timeout.",
  "  --preflight-timeout-ms=<ms>       Deployed /session preflight timeout.",
  "",
  "Environment:",
  "  MOCKD_E2E_BASE_URL or PLAYWRIGHT_BASE_URL can provide the deployed URL.",
  "  MOCKD_E2E_TARGET=deployed forces deployed mode.",
  "  MOCKD_E2E_DEPLOYED_* values identify pre-provisioned smoke records.",
  "  MOCKD_E2E_RUN_ID, MOCKD_E2E_PASSWORD, and MOCKD_E2E_EMAIL_DOMAIN are local only.",
].join("\n");
