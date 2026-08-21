import { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as postgresClientModule from "../../src/platform/postgresClient.js";
import { readPlatformRuntimeConfig } from "../../src/platform/platformRuntimeConfig.js";
import * as platformServerModule from "../../src/platform/platformServer.js";
import {
  createPlatformWebReadinessProbe,
  startPlatformWebFromEnv,
} from "../../src/platform/startPlatformWeb.js";
import {
  cleanupPlatformWebTest,
  createTemporaryDirectory,
} from "./support.js";

afterEach(cleanupPlatformWebTest);

const startupProcessTestTimeoutMs = 10_000;

describe("platform web startup failures", () => {
  it("emits a sanitized structured error when process startup fails", async () => {
    const result = await new Promise<{ exitCode: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["dist/src/platform/startPlatformWeb.js"],
        {
          cwd: process.cwd(),
          env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            NODE_ENV: "production",
            MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
            MOCKD_PROVISIONING_TOKEN: "must-never-appear-in-logs",
          },
          stdio: ["ignore", "ignore", "pipe"],
        },
      );
      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", chunk => {
        stderr += String(chunk);
      });
      child.once("error", reject);
      child.once("close", exitCode => resolve({ exitCode, stderr }));
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(result.stderr)).toMatchObject({
      level: "error",
      event: "platform_startup_failed",
      errorCode: "startup_failed",
    });
    expect(result.stderr).not.toMatch(/must-never-appear|Error:|\n\s+at /);
  }, startupProcessTestTimeoutMs);

  it("reports unready when Postgres is required but its client is unavailable", async () => {
    const config = readPlatformRuntimeConfig({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
    });
    const readinessProbe = createPlatformWebReadinessProbe(config, undefined);
    await expect(readinessProbe()).resolves.toBe(false);
  });

  it("closes Postgres when server startup fails", async () => {
    const closePool = vi.fn(async () => undefined);
    const postgresClient = new postgresClientModule.NodePostgresClient({
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => {
        throw new Error("No transaction expected in startup cleanup test.");
      },
      end: closePool,
    });
    const startPlatformServer = vi.spyOn(platformServerModule, "startPlatformServer")
      .mockRejectedValue(new Error("server startup failed"));

    await expect(startPlatformWebFromEnv({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_ENABLE_LEGACY_MOCK_BATCH: "true",
      MOCKD_LIVE_DRAFT_EVENT_STREAM_MAX_CONNECTIONS: "720",
      MOCKD_TRUST_PROXY: "true",
    }, { postgresClientFactory: () => postgresClient })).rejects.toThrow("server startup failed");
    expect(startPlatformServer).toHaveBeenCalledWith(expect.objectContaining({
      legacyMockBatchEnabled: true,
      liveDraftRoomEventStreamMaxConnections: 720,
      trustProxy: true,
    }));
    expect(closePool).toHaveBeenCalledOnce();
  });

  it("fails closed when only local file storage is configured by default", async () => {
    const directory = await createTemporaryDirectory();
    let startupError: unknown;
    try {
      await startPlatformWebFromEnv({
        HOST: "127.0.0.1",
        MOCKD_PLATFORM_DATA_FILE: `${directory}/platform.json`,
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: `${directory}/draft-tools`,
      });
    } catch (error) {
      startupError = error;
    }
    expect(startupError).toEqual(new Error(
      "DATABASE_URL is required unless MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is set outside production.",
    ));
  });
});
