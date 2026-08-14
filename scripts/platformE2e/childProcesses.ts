import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { shutdownTimeoutMs } from "./contracts.js";

interface ChildExit {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export const delay = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export const commandFor = (command: string): string =>
  process.platform === "win32" ? `${command}.cmd` : command;

const childExit = (child: ChildProcess): Promise<ChildExit> =>
  new Promise(resolve => {
    child.once("exit", (exitCode, signal) => resolve({ exitCode, signal }));
  });

export const runChild = async (
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<number> => {
  const child = spawn(commandFor(command), args, { env, stdio: "inherit" });
  const result = await childExit(child);
  return result.signal === null ? result.exitCode ?? 1 : 1;
};

export const terminate = async (child: ChildProcess | undefined): Promise<void> => {
  if (child === undefined || child.exitCode !== null || child.pid === undefined) return;
  child.kill("SIGTERM");
  await Promise.race([childExit(child), delay(shutdownTimeoutMs)]);
  if (child.exitCode === null) child.kill("SIGKILL");
};

export const availablePort = async (): Promise<number> => {
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
    server.close(error => error === undefined ? resolve() : reject(error));
  });
  return address.port;
};

export const waitForPlatformServer = async (
  url: string,
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> => {
  const startedAt = Date.now();
  const healthUrl = new URL("/readyz", url);
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Platform web exited before ${healthUrl.toString()} responded.`);
    }
    try {
      const response = await fetch(healthUrl);
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      // Startup probes retry until the configured timeout.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for platform web at ${healthUrl.toString()}.`);
};
