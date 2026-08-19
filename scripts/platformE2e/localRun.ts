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
import { type PlatformE2eRunConfig } from "./contracts.js";
import { optionalProcessEnv } from "./environment.js";
import { playwrightEnvironment } from "./playwrightEnvironment.js";

interface LocalServerConfig {
  command: string;
  args: readonly string[];
  port: number;
  dataFilePath: string;
  draftToolsDirectory: string;
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
  MOCKD_SCREENSHOT_IMPORT_MODE: "disabled",
  OPENAI_API_KEY: "",
  FANTASYPROS_API_KEY: "",
  MOCKD_PLAYER_NEWS_REFRESH_ENABLED: "false",
});

const startLocalServer = (config: LocalServerConfig): ChildProcess =>
  spawn(commandFor(config.command), config.args, {
    env: localServerEnvironment(config),
    stdio: "inherit",
  });

export const runLocalPlatformE2e = async (
  config: PlatformE2eRunConfig,
): Promise<number> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-e2e-"));
  const externalDataFilePath = optionalProcessEnv("MOCKD_E2E_DATA_FILE");
  const dataFilePath = externalDataFilePath ?? join(temporaryDirectory, "platform-store.json");
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let platformProcess: ChildProcess | undefined;

  try {
    if (externalDataFilePath === undefined) {
      await writePlatformStoreSnapshot(dataFilePath, emptyPlatformStoreSnapshot());
    }
    platformProcess = startLocalServer({
      command: "npm",
      args: ["run", "platform:web"],
      port,
      dataFilePath,
      draftToolsDirectory: join(temporaryDirectory, "draft-tools"),
    });
    await waitForPlatformServer(baseUrl, platformProcess, config.serverStartupTimeoutMs);
    return await runChild("playwright", ["test", ...config.playwrightArgs], {
      ...playwrightEnvironment(config, dataFilePath),
      PLAYWRIGHT_BASE_URL: baseUrl,
      MOCKD_E2E_PROVISIONING_TOKEN: "local-e2e-provisioning-token",
    });
  } finally {
    await terminate(platformProcess);
    if (externalDataFilePath === undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
};
