import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  emptyPlatformStoreSnapshot,
} from "../src/platform/platformStoreSnapshotCodec.js";
import {
  writePlatformStoreSnapshot,
} from "../src/platform/filePlatformStore.js";

export type PlatformE2eTarget = "local" | "deployed";

export interface PlatformE2eEnv {
  readonly [key: string]: string | undefined;
}

export interface PlatformE2eRunConfig {
  target: PlatformE2eTarget;
  baseUrl: string | undefined;
  smokeRunId: string | undefined;
  deployedSmoke: DeployedPlatformSmokeConfig | undefined;
  playwrightArgs: readonly string[];
  serverStartupTimeoutMs: number;
  deployedPreflightTimeoutMs: number;
  helpRequested: boolean;
}

export interface DeployedPlatformSmokeConfig {
  commissionerEmail: string;
  commissionerPassword: string;
  memberEmail: string;
  memberPassword: string;
  seasonId: string;
}

export type PlatformE2eFetch = (input: URL, init?: RequestInit) => Promise<Response>;

interface ParsedRunnerArgs {
  target: PlatformE2eTarget | undefined;
  baseUrl: string | undefined;
  smokeRunId: string | undefined;
  serverStartupTimeoutMs: number | undefined;
  deployedPreflightTimeoutMs: number | undefined;
  playwrightArgs: readonly string[];
  helpRequested: boolean;
}

interface ParsedOptionValue {
  value: string;
  nextIndex: number;
}

const defaultServerStartupTimeoutMs = 30_000;
const defaultDeployedPreflightTimeoutMs = 15_000;
const shutdownTimeoutMs = 5_000;
const screenshotAnalysisE2eApiKey = "mockd-e2e-deterministic-analyzer";
const deployedSmokeEnvironment = {
  commissionerEmail: "MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL",
  commissionerPassword: "MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD",
  memberEmail: "MOCKD_E2E_DEPLOYED_MEMBER_EMAIL",
  memberPassword: "MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD",
  seasonId: "MOCKD_E2E_DEPLOYED_SEASON_ID",
} as const;
const localFixtureEnvironment = [
  "MOCKD_E2E_DATA_FILE",
  "MOCKD_E2E_EMAIL_DOMAIN",
  "MOCKD_E2E_PASSWORD",
  "MOCKD_E2E_PROVISIONING_TOKEN",
  "MOCKD_E2E_RUN_ID",
] as const;

const optionalEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
};

const optionalEnvFrom = (env: PlatformE2eEnv, key: string): string | undefined => {
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
};

const optionValue = (
  args: readonly string[],
  index: number,
  option: string,
): ParsedOptionValue | null => {
  const arg = args[index];
  if (arg === undefined) return null;

  const inlinePrefix = `${option}=`;
  if (arg.startsWith(inlinePrefix)) {
    return { value: arg.slice(inlinePrefix.length), nextIndex: index };
  }

  if (arg !== option) return null;

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return { value, nextIndex: index + 1 };
};

const targetValue = (value: string | undefined, source: string): PlatformE2eTarget | undefined => {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "local" || normalized === "deployed") return normalized;

  throw new Error(`${source} must be local or deployed.`);
};

const positiveIntegerValue = (value: string, source: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${source} must be a positive integer.`);
  }

  return parsed;
};

const positiveIntegerEnv = (
  env: PlatformE2eEnv,
  key: string,
  fallback: number,
): number => {
  const value = optionalEnvFrom(env, key);

  return value === undefined ? fallback : positiveIntegerValue(value, key);
};

const normalizeBaseUrl = (value: string, source: string): string => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) throw new Error(`${source} cannot be empty.`);

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error(`${source} must be a valid URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${source} must use http or https.`);
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`${source} must not include a query string or hash.`);
  }

  return url.toString().replace(/\/$/, "");
};

const normalizeSmokeRunId = (value: string, source: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new Error(`${source} must contain at least one letter or number.`);
  }

  return normalized;
};

const smokeRunIdFor = (
  rawSmokeRunId: string | undefined,
  source: string,
): string | undefined => {
  if (rawSmokeRunId !== undefined) return normalizeSmokeRunId(rawSmokeRunId, source);

  return undefined;
};

const deployedSmokeConfigFrom = (env: PlatformE2eEnv): DeployedPlatformSmokeConfig => {
  const values = Object.entries(deployedSmokeEnvironment).map(([key, environmentKey]) => [
    key,
    environmentKey,
    optionalEnvFrom(env, environmentKey),
  ] as const);
  const missing = values
    .filter(([, , value]) => value === undefined)
    .map(([, environmentKey]) => environmentKey);
  if (missing.length > 0) {
    throw new Error(
      `Deployed platform smoke requires pre-provisioned records. Missing: ${missing.join(", ")}.`,
    );
  }

  const requiredValue = (key: keyof typeof deployedSmokeEnvironment): string => {
    const value = optionalEnvFrom(env, deployedSmokeEnvironment[key]);
    if (value === undefined) throw new Error(`Missing ${deployedSmokeEnvironment[key]}.`);
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

const baseUrlSourceFor = (
  parsedBaseUrl: string | undefined,
  envBaseUrl: string | undefined,
): string => {
  if (parsedBaseUrl !== undefined) return "--base-url";
  if (envBaseUrl !== undefined) return "MOCKD_E2E_BASE_URL";

  return "PLAYWRIGHT_BASE_URL";
};

const parseRunnerArgs = (rawArgs: readonly string[]): ParsedRunnerArgs => {
  const playwrightArgs: string[] = [];
  let target: PlatformE2eTarget | undefined;
  let baseUrl: string | undefined;
  let smokeRunId: string | undefined;
  let serverStartupTimeoutMs: number | undefined;
  let deployedPreflightTimeoutMs: number | undefined;
  let helpRequested = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === undefined) continue;

    if (arg === "--") {
      playwrightArgs.push(...rawArgs.slice(index + 1));
      break;
    }
    if (arg === "--help" || arg === "-h") {
      helpRequested = true;
      continue;
    }
    if (arg === "--deployed") {
      target = "deployed";
      continue;
    }
    if (arg === "--local") {
      target = "local";
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

    const serverTimeoutOption = optionValue(rawArgs, index, "--server-startup-timeout-ms");
    if (serverTimeoutOption !== null) {
      serverStartupTimeoutMs = positiveIntegerValue(
        serverTimeoutOption.value,
        "--server-startup-timeout-ms",
      );
      index = serverTimeoutOption.nextIndex;
      continue;
    }

    const preflightTimeoutOption = optionValue(rawArgs, index, "--preflight-timeout-ms");
    if (preflightTimeoutOption !== null) {
      deployedPreflightTimeoutMs = positiveIntegerValue(
        preflightTimeoutOption.value,
        "--preflight-timeout-ms",
      );
      index = preflightTimeoutOption.nextIndex;
      continue;
    }

    playwrightArgs.push(arg);
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
  "  --base-url=<url>                  Run against an already deployed Mockd URL without starting platform:web.",
  "  --target=local|deployed           Force local or deployed mode. Defaults to deployed when a base URL is set.",
  "  --smoke-run-id=<id>               Namespace local fixture records when reusing a local E2E data file.",
  "  --server-startup-timeout-ms=<ms>  Local platform:web startup timeout.",
  "  --preflight-timeout-ms=<ms>       Deployed /session route preflight timeout.",
  "",
  "Environment:",
  "  MOCKD_E2E_BASE_URL or PLAYWRIGHT_BASE_URL can provide the deployed base URL.",
  "  MOCKD_E2E_TARGET=deployed forces deployed mode.",
  "  MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL and MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD identify the pre-provisioned commissioner.",
  "  MOCKD_E2E_DEPLOYED_MEMBER_EMAIL and MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD identify the pre-provisioned member.",
  "  MOCKD_E2E_DEPLOYED_SEASON_ID identifies a dedicated, unused smoke season.",
  "  MOCKD_E2E_RUN_ID, MOCKD_E2E_PASSWORD, and MOCKD_E2E_EMAIL_DOMAIN customize local fixtures only.",
].join("\n");

export const resolvePlatformE2eRunConfig = (
  env: PlatformE2eEnv = process.env,
  rawArgs: readonly string[] = process.argv.slice(2),
): PlatformE2eRunConfig => {
  const parsedArgs = parseRunnerArgs(rawArgs);
  if (parsedArgs.helpRequested) {
    return {
      target: parsedArgs.target ?? "local",
      baseUrl: undefined,
      smokeRunId: undefined,
      deployedSmoke: undefined,
      playwrightArgs: parsedArgs.playwrightArgs,
      serverStartupTimeoutMs: parsedArgs.serverStartupTimeoutMs ?? defaultServerStartupTimeoutMs,
      deployedPreflightTimeoutMs: parsedArgs.deployedPreflightTimeoutMs ?? defaultDeployedPreflightTimeoutMs,
      helpRequested: true,
    };
  }

  const envTarget = targetValue(optionalEnvFrom(env, "MOCKD_E2E_TARGET"), "MOCKD_E2E_TARGET");
  const envBaseUrl = optionalEnvFrom(env, "MOCKD_E2E_BASE_URL");
  const playwrightBaseUrl = optionalEnvFrom(env, "PLAYWRIGHT_BASE_URL");
  const rawBaseUrl = parsedArgs.baseUrl
    ?? envBaseUrl
    ?? playwrightBaseUrl;
  const baseUrlSource = baseUrlSourceFor(parsedArgs.baseUrl, envBaseUrl);
  const baseUrl = rawBaseUrl === undefined
    ? undefined
    : normalizeBaseUrl(rawBaseUrl, baseUrlSource);
  const target = parsedArgs.target ?? envTarget ?? (baseUrl === undefined ? "local" : "deployed");

  if (target === "deployed" && baseUrl === undefined) {
    throw new Error("--base-url or MOCKD_E2E_BASE_URL is required for deployed platform smoke.");
  }
  if (target === "local" && baseUrl !== undefined) {
    throw new Error("Use --target=deployed when providing --base-url, MOCKD_E2E_BASE_URL, or PLAYWRIGHT_BASE_URL.");
  }

  if (target === "deployed") {
    if (parsedArgs.smokeRunId !== undefined) {
      throw new Error("--smoke-run-id only applies to local platform E2E runs.");
    }
    const localOnlyEnvironment = localFixtureEnvironment.find(key => optionalEnvFrom(env, key) !== undefined);
    if (localOnlyEnvironment !== undefined) {
      throw new Error(`${localOnlyEnvironment} only applies to local platform E2E runs.`);
    }
  }

  const rawSmokeRunId = parsedArgs.smokeRunId ?? optionalEnvFrom(env, "MOCKD_E2E_RUN_ID");
  const smokeRunId = smokeRunIdFor(
    rawSmokeRunId,
    parsedArgs.smokeRunId === undefined ? "MOCKD_E2E_RUN_ID" : "--smoke-run-id",
  );
  const deployedSmoke = target === "deployed" ? deployedSmokeConfigFrom(env) : undefined;
  const serverStartupTimeoutMs = parsedArgs.serverStartupTimeoutMs
    ?? positiveIntegerEnv(
      env,
      "MOCKD_E2E_SERVER_STARTUP_TIMEOUT_MS",
      defaultServerStartupTimeoutMs,
    );
  const deployedPreflightTimeoutMs = parsedArgs.deployedPreflightTimeoutMs
    ?? positiveIntegerEnv(
      env,
      "MOCKD_E2E_PREFLIGHT_TIMEOUT_MS",
      defaultDeployedPreflightTimeoutMs,
    );

  return {
    target,
    baseUrl,
    smokeRunId,
    deployedSmoke,
    playwrightArgs: parsedArgs.playwrightArgs,
    serverStartupTimeoutMs,
    deployedPreflightTimeoutMs,
    helpRequested: parsedArgs.helpRequested,
  };
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const availablePort = async (): Promise<number> => {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected a TCP port.");
  }

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });

  return address.port;
};

const waitForPlatformServer = async (
  url: string,
  process: ChildProcess,
  timeoutMs: number,
): Promise<void> => {
  const startedAt = Date.now();
  const healthUrl = new URL("/readyz", url);

  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) {
      throw new Error(`Platform web exited before ${healthUrl.toString()} responded.`);
    }

    try {
      const response = await fetch(healthUrl);
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      // The server may not be listening yet.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for platform web at ${healthUrl.toString()}.`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const bodySnippet = (text: string): string => {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "empty body";

  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
};

const parseJsonBody = (text: string, sessionUrl: URL, status: number, contentType: string): unknown => {
  if (text.trim().length === 0) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Expected ${sessionUrl.toString()} to return Mockd /session JSON. ` +
      `Received HTTP ${status} ${contentType}: ${bodySnippet(text)}. ` +
      "The response had a JSON content type but was not parseable JSON.",
    );
  }
};

export const verifyDeployedPlatformSessionRoute = async (
  baseUrl: string,
  fetchSession: PlatformE2eFetch = fetch,
  timeoutMs = defaultDeployedPreflightTimeoutMs,
): Promise<void> => {
  const sessionUrl = new URL("/session", baseUrl);
  let response: Response;

  try {
    response = await fetchSession(sessionUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Could not reach deployed Mockd /session at ${sessionUrl.toString()}: ${message}. ` +
      "Check --base-url or MOCKD_E2E_BASE_URL and confirm the deployment is reachable from this machine.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const jsonBody = contentType.toLowerCase().includes("application/json")
    ? parseJsonBody(text, sessionUrl, response.status, contentType)
    : undefined;
  const error = isRecord(jsonBody) ? jsonBody.error : undefined;
  const errorCode = isRecord(error) ? error.code : undefined;

  if (response.status === 401 && errorCode === "auth_required") return;
  if (response.status === 200 && isRecord(jsonBody) && isRecord(jsonBody.account)) return;

  throw new Error(
    `Expected ${sessionUrl.toString()} to return Mockd /session JSON. ` +
    `Received HTTP ${response.status} ${contentType || "without content-type"}: ${bodySnippet(text)}. ` +
    "Check that --base-url points at the platform deployment root and that /session is routed to Mockd.",
  );
};

const commandFor = (command: string): string =>
  process.platform === "win32" ? `${command}.cmd` : command;

const runChild = async (
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<number> => {
  const child = spawn(commandFor(command), args, {
    env,
    stdio: "inherit",
  });

  const [exitCode, signal] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
  if (signal !== null) return 1;

  return exitCode ?? 1;
};

const terminate = async (child: ChildProcess | undefined): Promise<void> => {
  if (child === undefined || child.exitCode !== null) return;

  const targetPid = child.pid;
  if (targetPid === undefined) return;

  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    delay(shutdownTimeoutMs),
  ]);

  if (child.exitCode === null) child.kill("SIGKILL");
};

const playwrightEnvFor = (
  config: PlatformE2eRunConfig,
  dataFilePath?: string | undefined,
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MOCKD_E2E_TARGET: config.target,
  };

  for (const key of Object.values(deployedSmokeEnvironment)) delete env[key];

  if (config.target === "deployed") {
    for (const key of localFixtureEnvironment) delete env[key];
    delete env.MOCKD_ALLOW_PUBLIC_SIGNUP;
    delete env.MOCKD_PROVISIONING_TOKEN;
  }

  if (config.baseUrl !== undefined) env.PLAYWRIGHT_BASE_URL = config.baseUrl;
  if (config.smokeRunId !== undefined) env.MOCKD_E2E_RUN_ID = config.smokeRunId;
  if (dataFilePath !== undefined) env.MOCKD_E2E_DATA_FILE = dataFilePath;
  if (config.deployedSmoke !== undefined) {
    env.MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL = config.deployedSmoke.commissionerEmail;
    env.MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD = config.deployedSmoke.commissionerPassword;
    env.MOCKD_E2E_DEPLOYED_MEMBER_EMAIL = config.deployedSmoke.memberEmail;
    env.MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD = config.deployedSmoke.memberPassword;
    env.MOCKD_E2E_DEPLOYED_SEASON_ID = config.deployedSmoke.seasonId;
  }

  return env;
};

const runDeployedPlatformE2e = async (config: PlatformE2eRunConfig): Promise<number> => {
  if (config.baseUrl === undefined) {
    throw new Error("--base-url or MOCKD_E2E_BASE_URL is required for deployed platform smoke.");
  }

  await verifyDeployedPlatformSessionRoute(
    config.baseUrl,
    fetch,
    config.deployedPreflightTimeoutMs,
  );
  console.log(
    `Running deployed platform smoke against ${config.baseUrl} ` +
    `with pre-provisioned season ${config.deployedSmoke?.seasonId}.`,
  );

  return await runChild("playwright", ["test", ...config.playwrightArgs], playwrightEnvFor(config));
};

const runLocalPlatformE2e = async (config: PlatformE2eRunConfig): Promise<number> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-e2e-"));
  const externalDataFilePath = optionalEnv("MOCKD_E2E_DATA_FILE");
  const dataFilePath = externalDataFilePath ?? join(temporaryDirectory, "platform-store.json");
  const screenshotDataFilePath = join(temporaryDirectory, "screenshot-platform-store.json");
  const port = await availablePort();
  let screenshotPort = await availablePort();
  while (screenshotPort === port) screenshotPort = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const screenshotBaseUrl = `http://127.0.0.1:${screenshotPort}`;
  let platformProcess: ChildProcess | undefined;
  let screenshotPlatformProcess: ChildProcess | undefined;

  try {
    if (externalDataFilePath === undefined) {
      await writePlatformStoreSnapshot(dataFilePath, emptyPlatformStoreSnapshot());
    }
    await writePlatformStoreSnapshot(screenshotDataFilePath, emptyPlatformStoreSnapshot());

    platformProcess = spawn(commandFor("npm"), ["run", "platform:web"], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATABASE_URL: "",
        MOCKD_DATABASE_URL: "",
        MOCKD_PLATFORM_DATA_FILE: dataFilePath,
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "draft-tools"),
        MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
        MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
        MOCKD_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
        MOCKD_SCREENSHOT_IMPORT_MODE: "disabled",
        OPENAI_API_KEY: "",
      },
      stdio: "inherit",
    });
    screenshotPlatformProcess = spawn(
      commandFor("node"),
      ["dist/scripts/start-screenshot-analysis-e2e.js"],
      {
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(screenshotPort),
          DATABASE_URL: "",
          MOCKD_DATABASE_URL: "",
          MOCKD_PLATFORM_DATA_FILE: screenshotDataFilePath,
          MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "screenshot-draft-tools"),
          MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
          MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
          MOCKD_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
          MOCKD_SCREENSHOT_IMPORT_MODE: "openai",
          OPENAI_API_KEY: screenshotAnalysisE2eApiKey,
        },
        stdio: "inherit",
      },
    );

    await Promise.all([
      waitForPlatformServer(baseUrl, platformProcess, config.serverStartupTimeoutMs),
      waitForPlatformServer(screenshotBaseUrl, screenshotPlatformProcess, config.serverStartupTimeoutMs),
    ]);

    const exitCode = await runChild("playwright", ["test", ...config.playwrightArgs], {
      ...playwrightEnvFor(config, dataFilePath),
      PLAYWRIGHT_BASE_URL: baseUrl,
      MOCKD_E2E_SCREENSHOT_BASE_URL: screenshotBaseUrl,
      MOCKD_E2E_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
    });
    return exitCode;
  } finally {
    await Promise.all([
      terminate(platformProcess),
      terminate(screenshotPlatformProcess),
    ]);
    if (externalDataFilePath === undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
};

export const runPlatformE2e = async (
  config = resolvePlatformE2eRunConfig(),
): Promise<number> => {
  if (config.helpRequested) {
    console.log(platformE2eRunnerUsage);
    return 0;
  }

  return config.target === "deployed"
    ? await runDeployedPlatformE2e(config)
    : await runLocalPlatformE2e(config);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPlatformE2e().then(exitCode => {
    process.exitCode = exitCode;
  }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
