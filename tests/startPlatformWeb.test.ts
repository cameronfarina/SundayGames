import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import * as postgresClientModule from "../src/platform/postgresClient.js";
import * as platformServerModule from "../src/platform/platformServer.js";
import {
  createPlatformWebReadinessProbe,
  startPlatformWebFromEnv,
  type StartedPlatformWebProcess,
} from "../src/platform/startPlatformWeb.js";
import { readPlatformRuntimeConfig } from "../src/platform/platformRuntimeConfig.js";

let startedProcess: StartedPlatformWebProcess | undefined;
let temporaryDirectory: string | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const recordValue = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected record value.");

  return value;
};

const stringValue = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string value.");

  return value;
};

afterEach(async () => {
  await startedProcess?.close();
  startedProcess = undefined;
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
  vi.restoreAllMocks();
});

describe("platform web startup", () => {
  it("emits a sanitized structured error when process startup fails", async () => {
    const result = await new Promise<{ exitCode: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "src/platform/startPlatformWeb.ts"],
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
  });

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
    vi.spyOn(postgresClientModule, "createNodePostgresClient").mockReturnValue(postgresClient);
    const startPlatformServer = vi.spyOn(platformServerModule, "startPlatformServer").mockRejectedValue(
      new Error("server startup failed"),
    );

    await expect(startPlatformWebFromEnv({
      DATABASE_URL: "postgres://mockd:test@localhost:5432/mockd",
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: "/var/lib/mockd/draft-tools",
      MOCKD_TRUST_PROXY: "true",
    })).rejects.toThrow("server startup failed");
    expect(startPlatformServer).toHaveBeenCalledWith(expect.objectContaining({
      trustProxy: true,
    }));
    expect(closePool).toHaveBeenCalledOnce();
  });

  it("fails closed when only local file storage is configured by default", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-web-"));
    let startupError: unknown;

    try {
      startedProcess = await startPlatformWebFromEnv({
        HOST: "127.0.0.1",
        MOCKD_PLATFORM_DATA_FILE: join(temporaryDirectory, "platform.json"),
        MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "draft-tools"),
      });
    } catch (error) {
      startupError = error;
    }

    expect(startupError).toEqual(new Error(
      "DATABASE_URL is required unless MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is set outside production.",
    ));
  });

  it("starts an explicit local-fixture preview with file-backed storage", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-web-"));
    startedProcess = await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: join(temporaryDirectory, "platform.json"),
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "draft-tools"),
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    });

    const response = await fetch(`${startedProcess.server.url}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "mockd-platform",
      status: "ok",
    });
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining(
      '"event":"http_request_completed"',
    ));

    const accountResponse = await fetch(`${startedProcess.server.url}/accounts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "preview-user@example.com",
        password: "secure preview password",
      }),
    });
    expect(accountResponse.status).toBe(201);
  });

  it("forwards the provisioning token while public signup remains closed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-web-"));
    startedProcess = await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: join(temporaryDirectory, "platform.json"),
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "draft-tools"),
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
      MOCKD_PROVISIONING_TOKEN: "local-provisioning-token",
    });

    const response = await fetch(`${startedProcess.server.url}/accounts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mockd-provisioning-token": "local-provisioning-token",
      },
      body: JSON.stringify({
        email: "provisioned-user@example.com",
        password: "secure provisioned password",
      }),
    });

    expect(response.status).toBe(201);
  });

  it("provides local live-draft setup data only in local-fixture mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-web-"));
    startedProcess = await startPlatformWebFromEnv({
      HOST: "127.0.0.1",
      MOCKD_PLATFORM_DATA_FILE: join(temporaryDirectory, "platform.json"),
      MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: join(temporaryDirectory, "draft-tools"),
      MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
      MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    });
    const handle = startedProcess.server.handler;

    await handle({
      method: "POST",
      path: "/accounts",
      body: { email: "league-owner@example.com", password: "secure owner password" },
    });
    const login = await handle({
      method: "POST",
      path: "/sessions",
      body: { email: "league-owner@example.com", password: "secure owner password" },
    });
    const loginBody = recordValue(login.body);
    const account = recordValue(loginBody.account);
    const accountId = stringValue(account.id);
    const sessionToken = stringValue(loginBody.sessionToken);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Local fixture league",
      setupStatus: "published",
    });
    const ownerTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (ownerTeam === undefined) throw new Error("Expected local fixture owner team.");

    const published = await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken,
      body: {
        season,
        memberships: [{
          userId: accountId,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: ownerTeam.ownerId,
          teamId: ownerTeam.id,
        }],
      },
    });
    expect(published.status).toBe(200);

    const created = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken,
      body: {},
    });

    expect(created).toMatchObject({
      status: 201,
      body: {
        room: {
          seasonId: season.id,
          playerCatalog: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
        },
      },
    });
  });
});
