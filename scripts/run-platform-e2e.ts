import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import {
  emptyPlatformStoreSnapshot,
} from "../src/platform/platformStoreSnapshotCodec.js";
import {
  writePlatformStoreSnapshot,
} from "../src/platform/filePlatformStore.js";

const serverStartupTimeoutMs = 30_000;
const shutdownTimeoutMs = 5_000;

const optionalEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
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
): Promise<void> => {
  const startedAt = Date.now();
  const healthUrl = new URL("/session", url);

  while (Date.now() - startedAt < serverStartupTimeoutMs) {
    if (process.exitCode !== null) {
      throw new Error(`Platform web exited before ${healthUrl.toString()} responded.`);
    }

    try {
      const response = await fetch(healthUrl);
      await response.arrayBuffer();

      return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`Timed out waiting for platform web at ${healthUrl.toString()}.`);
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

const run = async (): Promise<void> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-e2e-"));
  const externalDataFilePath = optionalEnv("MOCKD_E2E_DATA_FILE");
  const dataFilePath = externalDataFilePath ?? join(temporaryDirectory, "platform-store.json");
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let platformProcess: ChildProcess | undefined;

  try {
    if (externalDataFilePath === undefined) {
      await writePlatformStoreSnapshot(dataFilePath, emptyPlatformStoreSnapshot());
    }

    platformProcess = spawn(commandFor("npm"), ["run", "platform:web"], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATABASE_URL: "",
        MOCKD_DATABASE_URL: "",
        MOCKD_PLATFORM_DATA_FILE: dataFilePath,
      },
      stdio: "inherit",
    });

    await waitForPlatformServer(baseUrl, platformProcess);

    const exitCode = await runChild("playwright", ["test", ...process.argv.slice(2)], {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      MOCKD_E2E_DATA_FILE: dataFilePath,
    });
    process.exitCode = exitCode;
  } finally {
    await terminate(platformProcess);
    if (externalDataFilePath === undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
};

void run().catch(error => {
  console.error(error);
  process.exit(1);
});
