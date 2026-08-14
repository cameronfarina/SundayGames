import { startPlatformWebFromEnv } from "./start.js";

export interface PlatformWebProcessHost {
  once(signal: NodeJS.Signals, listener: () => void): void;
  exit(code: number): void;
}

export interface PlatformWebProcessLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface PlatformWebProcessHandle {
  server: { host: string; port: number };
  close: () => Promise<void>;
}

export type StartPlatformWebProcess = () => Promise<PlatformWebProcessHandle>;

const logPlatformStarted = (
  logger: PlatformWebProcessLogger,
  host: string,
  port: number,
): void => {
  logger.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "platform_started",
    host,
    port,
  }));
};

const logPlatformStartupFailed = (logger: PlatformWebProcessLogger): void => {
  logger.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event: "platform_startup_failed",
    errorCode: "startup_failed",
  }));
};

export const runPlatformWebProcess = async (
  start: StartPlatformWebProcess = startPlatformWebFromEnv,
  host: PlatformWebProcessHost = process,
  logger: PlatformWebProcessLogger = console,
): Promise<void> => {
  const runtime = await start();
  logPlatformStarted(logger, runtime.server.host, runtime.server.port);

  const shutdown = (): void => {
    void runtime.close().finally(() => host.exit(0));
  };
  host.once("SIGINT", shutdown);
  host.once("SIGTERM", shutdown);
};

export const runPlatformWebMain = async (
  start: StartPlatformWebProcess = startPlatformWebFromEnv,
  host: PlatformWebProcessHost = process,
  logger: PlatformWebProcessLogger = console,
): Promise<void> => {
  try {
    await runPlatformWebProcess(start, host, logger);
  } catch {
    logPlatformStartupFailed(logger);
    host.exit(1);
  }
};
