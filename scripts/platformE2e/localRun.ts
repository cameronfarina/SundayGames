import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyPlatformStoreSnapshot } from "../../src/platform/platformStoreSnapshotCodec.js";
import { writePlatformStoreSnapshot } from "../../src/platform/filePlatformStore.js";
import {
  availablePort,
  commandFor,
  runChild,
  terminate,
  waitForPlatformServer,
} from "./childProcesses.js";
import {
  screenshotAnalysisE2eApiKey,
  type PlatformE2eRunConfig,
} from "./contracts.js";
import { optionalProcessEnv } from "./environment.js";
import { playwrightEnvironment } from "./playwrightEnvironment.js";

interface LocalServerConfig {
  command: string;
  args: readonly string[];
  port: number;
  dataFilePath: string;
  draftToolsDirectory: string;
  screenshotMode: "disabled" | "openai";
  openAiApiKey: string;
}

const localServerEnvironment = (config: LocalServerConfig): NodeJS.ProcessEnv => ({
  ...process.env,
  HOST: "127.0.0.1",
  PORT: String(config.port),
  DATABASE_URL: "",
  MOCKD_DATABASE_URL: "",
  MOCKD_PLATFORM_DATA_FILE: config.dataFilePath,
  MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: config.draftToolsDirectory,
  MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
  MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
  MOCKD_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
  MOCKD_SCREENSHOT_IMPORT_MODE: config.screenshotMode,
  OPENAI_API_KEY: config.openAiApiKey,
});

const startLocalServer = (config: LocalServerConfig): ChildProcess =>
  spawn(commandFor(config.command), config.args, {
    env: localServerEnvironment(config),
    stdio: "inherit",
  });

const distinctPortFrom = async (port: number): Promise<number> => {
  let candidate = await availablePort();
  while (candidate === port) candidate = await availablePort();
  return candidate;
};

export const runLocalPlatformE2e = async (
  config: PlatformE2eRunConfig,
): Promise<number> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-e2e-"));
  const externalDataFilePath = optionalProcessEnv("MOCKD_E2E_DATA_FILE");
  const dataFilePath = externalDataFilePath ?? join(temporaryDirectory, "platform-store.json");
  const screenshotDataFilePath = join(temporaryDirectory, "screenshot-platform-store.json");
  const port = await availablePort();
  const screenshotPort = await distinctPortFrom(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  const screenshotBaseUrl = `http://127.0.0.1:${screenshotPort}`;
  let platformProcess: ChildProcess | undefined;
  let screenshotProcess: ChildProcess | undefined;

  try {
    if (externalDataFilePath === undefined) {
      await writePlatformStoreSnapshot(dataFilePath, emptyPlatformStoreSnapshot());
    }
    await writePlatformStoreSnapshot(screenshotDataFilePath, emptyPlatformStoreSnapshot());
    platformProcess = startLocalServer({
      command: "npm",
      args: ["run", "platform:web"],
      port,
      dataFilePath,
      draftToolsDirectory: join(temporaryDirectory, "draft-tools"),
      screenshotMode: "disabled",
      openAiApiKey: "",
    });
    screenshotProcess = startLocalServer({
      command: "node",
      args: ["dist/scripts/start-screenshot-analysis-e2e.js"],
      port: screenshotPort,
      dataFilePath: screenshotDataFilePath,
      draftToolsDirectory: join(temporaryDirectory, "screenshot-draft-tools"),
      screenshotMode: "openai",
      openAiApiKey: screenshotAnalysisE2eApiKey,
    });
    await Promise.all([
      waitForPlatformServer(baseUrl, platformProcess, config.serverStartupTimeoutMs),
      waitForPlatformServer(screenshotBaseUrl, screenshotProcess, config.serverStartupTimeoutMs),
    ]);
    return await runChild("playwright", ["test", ...config.playwrightArgs], {
      ...playwrightEnvironment(config, dataFilePath),
      PLAYWRIGHT_BASE_URL: baseUrl,
      MOCKD_E2E_SCREENSHOT_BASE_URL: screenshotBaseUrl,
      MOCKD_E2E_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
    });
  } finally {
    await Promise.all([terminate(platformProcess), terminate(screenshotProcess)]);
    if (externalDataFilePath === undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
};
